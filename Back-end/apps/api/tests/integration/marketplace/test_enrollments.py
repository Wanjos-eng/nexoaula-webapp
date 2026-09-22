from datetime import datetime, UTC, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.modules.marketplace.repository import SqlAlchemyMarketplaceRepository
from tests.integration.marketplace.test_offers import offer

P = '/api/v1/marketplace'


def published(market):
    row = offer(market)
    assert market.client.post(f"{P}/sessions/{row['id']}/publish", json={}).status_code == 200
    return row


def test_search_filters_pagination_and_detail(market):
    row = published(market)
    draft = offer(market)
    market.as_user('student')
    c = market.client
    rows = c.get(P+'/sessions').json()
    assert [r['id'] for r in rows] == [row['id']]
    assert rows[0]['available_seats'] == 2 and rows[0]['commission_cents'] == 375
    assert rows[0]['subject_name'] == 'subject' and rows[0]['tutor_name'] == 'Aluno'
    for params in ({'subject_id': str(market.ids['subject'])}, {'topic': 'DERIVADAS'}, {'topic': 'contínuas'}):
        assert len(c.get(P+'/sessions', params=params).json()) == 1
    for params in ({'subject_id': str(market.ids['other_subject'])}, {'topic': '%'}, {'topic': '_'}, {'offset': 1}, {'starts_after': (datetime.now(UTC)+timedelta(days=2)).isoformat()}):
        assert c.get(P+'/sessions', params=params).json() == []
    assert c.get(P+'/sessions/'+row['id']).status_code == 200
    assert c.get(P+'/sessions/'+draft['id']).status_code == 404
    for params in ({'limit': 0}, {'limit': 101}, {'offset': -1}, {'starts_after': '2030-01-01T10:00:00'}):
        assert c.get(P+'/sessions', params=params).status_code == 422


@pytest.mark.parametrize('state', ['paused', 'suspended', 'inactive', 'cancelled', 'completed', 'past'])
def test_unavailable_offers_are_hidden(market, state):
    row = published(market)
    if state in ('paused', 'suspended'):
        market.connection.execute(text('UPDATE tutor_profiles SET status=:state WHERE user_id=:tutor'), market.ids | {'state': state})
    elif state == 'inactive':
        market.connection.execute(text('UPDATE users SET is_active=false WHERE id=:tutor'), market.ids)
    elif state == 'past':
        market.connection.execute(text("UPDATE tutor_sessions SET starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' WHERE id=:id"), {'id': row['id']})
    else:
        market.connection.execute(text('UPDATE tutor_sessions SET status=:state WHERE id=:id'), {'id': row['id'], 'state': state})
    market.as_user('student')
    assert market.client.get(P+'/sessions').json() == []
    assert market.client.get(P+'/sessions/'+row['id']).status_code == 404
    assert market.client.post(P+'/sessions/'+row['id']+'/enroll', json={}).status_code == 409


@pytest.mark.parametrize('amount,commission', [(0,0),(1,0),(3,0),(10,2),(30,5),(2500,375),(2147483647,322122547)])
def test_exact_commission_and_snapshot(market, amount, commission):
    market.payload['price_cents'] = amount
    row = published(market)
    market.as_user('student')
    response = market.client.post(P+'/sessions/'+row['id']+'/enroll', json={})
    assert response.status_code == 201, response.text
    receipt = response.json()
    assert receipt['simulated'] and 'Nenhum pagamento foi processado.' in receipt['notice']
    assert receipt['transaction']['commission_cents'] == commission
    assert receipt['transaction']['amount_cents'] == amount
    assert receipt['transaction']['status'] == 'completed' and receipt['transaction']['simulated']
    market.connection.execute(text('UPDATE tutor_sessions SET price_cents=777 WHERE id=:id'), {'id': row['id']})
    history = market.client.get(P+'/bookings/mine').json()
    assert history[0]['transaction'] == receipt['transaction']
    assert market.client.get(P+'/bookings/mine?session_id='+str(uuid4())).json() == []
    assert market.client.get(P+'/bookings/mine?offset=1').json() == []
    market.as_user('tutor')
    assert market.client.get(P+'/bookings/mine').json() == []


def test_capacity_duplicate_cancellation_and_reenrollment(market):
    market.payload['capacity'] = 1
    row = published(market)
    c = market.client
    path = P+'/sessions/'+row['id']+'/enroll'
    assert c.post(path, json={}).status_code == 409
    market.as_user('student')
    first = c.post(path, json={})
    assert first.status_code == 201
    assert c.post(path, json={}).status_code == 409
    assert c.get(P+'/sessions/'+row['id']).json()['available_seats'] == 0
    market.as_user('other')
    assert c.post(path, json={}).status_code == 409
    assert c.delete(path).status_code == 404
    market.as_user('student')
    cancelled = c.delete(path)
    assert cancelled.status_code == 200
    assert cancelled.json()['status'] == 'cancelled'
    assert cancelled.json()['transaction'] == first.json()['transaction']
    assert c.delete(path).status_code == 404
    second = c.post(path, json={})
    assert second.status_code == 201 and second.json()['booking_id'] != first.json()['booking_id']
    assert [r['status'] for r in c.get(P+'/bookings/mine').json()] == ['confirmed', 'cancelled']
    market.as_user('tutor')
    assert c.delete(P+'/sessions/'+row['id']).status_code == 200
    market.as_user('student')
    assert c.get(P+'/bookings/mine').json()[0]['status'] == 'cancelled'
    assert c.get(P+'/bookings/mine').json()[0]['transaction'] == second.json()['transaction']


def test_cancel_paused_profile_but_not_after_start(market):
    row = published(market)
    c = market.client
    path = P+'/sessions/'+row['id']+'/enroll'
    market.as_user('student')
    assert c.post(path, json={}).status_code == 201
    market.as_user('tutor')
    c.delete(P+'/tutor/deactivate')
    market.as_user('student')
    assert c.delete(path).status_code == 200
    market.as_user('tutor')
    c.post(P+'/tutor/activate', json={})
    market.as_user('student')
    assert c.post(path, json={}).status_code == 201
    market.service._clock = lambda: datetime.fromisoformat(row['starts_at'])
    assert c.delete(path).status_code == 409


@pytest.mark.parametrize('failure', ['receipt', 'database'])
def test_atomic_rollback(market, monkeypatch, failure):
    row = published(market)
    market.as_user('student')
    original = SqlAlchemyMarketplaceRepository.add_booking
    def broken(self, booking, receipt):
        if failure == 'receipt':
            receipt.commission_cents += 1
            original(self, booking, receipt)
        else:
            self._session.add(booking)
            self._session.flush()
            raise OperationalError('private SQL', {}, Exception('secret'))
    monkeypatch.setattr(SqlAlchemyMarketplaceRepository, 'add_booking', broken)
    response = market.client.post(P+'/sessions/'+row['id']+'/enroll', json={})
    assert response.status_code == (409 if failure == 'receipt' else 503)
    assert 'secret' not in response.text and 'SQL' not in response.text
    assert market.client.get(P+'/bookings/mine').json() == []
    assert market.connection.scalar(text('SELECT count(*) FROM session_bookings WHERE session_id=:id'), {'id': row['id']}) == 0


def test_identity_and_financial_fields_are_server_owned(market):
    row = published(market)
    market.as_user('student')
    path = P+'/sessions/'+row['id']+'/enroll'
    for payload in ({'user_id': str(market.ids['other'])}, {'amount_cents': 0}, {'commission_cents': 0}, {'simulated': False}):
        assert market.client.post(path, json=payload).status_code == 422
    assert market.client.post(P+'/sessions/'+str(uuid4())+'/enroll', json={}).status_code == 404
