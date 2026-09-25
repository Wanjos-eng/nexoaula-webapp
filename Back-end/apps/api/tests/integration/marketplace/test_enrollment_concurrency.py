"""Separate committed PostgreSQL connections exercise actual contention."""
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier, Event
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.modules.marketplace.errors import MarketplaceError
from app.modules.marketplace.repository import SqlAlchemyMarketplaceRepository, SqlAlchemyMarketplaceUnitOfWork
from app.modules.marketplace.service import MarketplaceService


@pytest.fixture
def committed_market():
    if not os.getenv('DATABASE_URL'):
        pytest.skip('PostgreSQL required')
    engine = create_engine(os.environ['DATABASE_URL'], connect_args={'options': '-c lock_timeout=5000'})
    ids = {key: uuid4() for key in ('tutor', 'student', 'other', 'institution', 'subject', 'session')}
    start = datetime.now(UTC)+timedelta(days=1)
    with engine.begin() as c:
        for key in ('tutor', 'student', 'other'):
            c.execute(text("INSERT INTO users(id,email,password_hash) VALUES (:id,:email,'synthetic')"), {'id':ids[key], 'email':f'{ids[key]}@example.test'})
        c.execute(text("INSERT INTO institutions(id,name) VALUES (:institution,'Synthetic concurrency')"), ids)
        c.execute(text("INSERT INTO subjects(id,institution_id,name) VALUES (:subject,:institution,'Concurrency')"), ids)
        c.execute(text('INSERT INTO tutor_profiles(user_id) VALUES (:tutor)'), ids)
        c.execute(text('INSERT INTO tutor_subjects(tutor_user_id,subject_id) VALUES (:tutor,:subject)'), ids)
        c.execute(text("INSERT INTO tutor_sessions(id,tutor_user_id,subject_id,title,modality,external_url,starts_at,ends_at,capacity,price_cents,status) VALUES (:session,:tutor,:subject,'Race','online','https://example.test',:start,:end,1,10,'scheduled')"),ids|{'start':start,'end':start+timedelta(hours=1)})
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    service = MarketplaceService(lambda: SqlAlchemyMarketplaceUnitOfWork(factory))
    try:
        yield SimpleNamespace(engine=engine,ids=ids,service=service,factory=factory,start=start)
    finally:
        with engine.begin() as c:
            for sql in [
                'DELETE FROM transactions WHERE session_booking_id IN (SELECT id FROM session_bookings WHERE session_id=:session)',
                'DELETE FROM session_bookings WHERE session_id=:session',
                'DELETE FROM tutor_sessions WHERE id=:session',
                'DELETE FROM tutor_subjects WHERE tutor_user_id=:tutor',
                'DELETE FROM tutor_profiles WHERE user_id=:tutor',
                'DELETE FROM subjects WHERE id=:subject',
                'DELETE FROM institutions WHERE id=:institution',
                'DELETE FROM users WHERE id IN (:tutor,:student,:other)',
            ]: c.execute(text(sql),ids)
        engine.dispose()


@pytest.mark.parametrize('same_user',[False,True])
def test_competing_enrollments_preserve_capacity_and_uniqueness(committed_market,same_user):
    m=committed_market
    if same_user:
        with m.engine.begin() as c:
            c.execute(text('UPDATE tutor_sessions SET capacity=2 WHERE id=:session'),m.ids)
    gate=Barrier(2)
    def enroll(user):
        gate.wait(timeout=5)
        try: return m.service.enroll(user,m.ids['session'])
        except MarketplaceError as error: return error
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(enroll,m.ids[key]) for key in ('student','student' if same_user else 'other')]
        results=[f.result(timeout=10) for f in futures]
    errors=[r for r in results if isinstance(r,MarketplaceError)]
    assert len(errors)==1 and errors[0].status_code==409
    assert ('ativa' if same_user else 'lotada') in str(errors[0])
    with m.engine.connect() as c:
        assert c.scalar(text('SELECT count(*) FROM session_bookings WHERE session_id=:session'),m.ids)==1
        assert c.scalar(text('SELECT count(*) FROM transactions WHERE session_booking_id IN (SELECT id FROM session_bookings WHERE session_id=:session)'),m.ids)==1
    fresh=MarketplaceService(lambda: SqlAlchemyMarketplaceUnitOfWork(m.factory))
    records=fresh.bookings_mine(m.ids['student'],20,0)+fresh.bookings_mine(m.ids['other'],20,0)
    assert len(records)==1 and records[0].transaction.commission_cents==2


@pytest.mark.parametrize('change',['cancel','pause','clock'])
def test_lock_wait_rechecks_state_and_time(committed_market,monkeypatch,change):
    m=committed_market
    observed=Event()
    original=SqlAlchemyMarketplaceRepository.session
    def read(self,session_id,*,lock=False):
        row=original(self,session_id,lock=lock)
        if not lock: observed.set()
        return row
    monkeypatch.setattr(SqlAlchemyMarketplaceRepository,'session',read)
    with m.engine.connect() as blocker:
        tx=blocker.begin()
        blocker.execute(text('SELECT user_id FROM tutor_profiles WHERE user_id=:tutor FOR UPDATE'),m.ids)
        with ThreadPoolExecutor(max_workers=1) as pool:
            future=pool.submit(m.service.enroll,m.ids['student'],m.ids['session'])
            try:
                assert observed.wait(timeout=5)
                if change=='cancel': blocker.execute(text("UPDATE tutor_sessions SET status='cancelled' WHERE id=:session"),m.ids)
                elif change=='pause': blocker.execute(text("UPDATE tutor_profiles SET status='paused' WHERE user_id=:tutor"),m.ids)
                else: m.service._clock=lambda:m.start
            finally: tx.commit()
            with pytest.raises(MarketplaceError) as caught: future.result(timeout=10)
            assert caught.value.status_code==409
    with m.engine.connect() as c:
        assert c.scalar(text('SELECT count(*) FROM session_bookings WHERE session_id=:session'),m.ids)==0
