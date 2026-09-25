from sqlalchemy import text

P = "/api/v1/marketplace"


def create_offer(market):
    assert market.client.post(P + "/tutor/activate", json={}).status_code == 200
    response = market.client.post(P + "/sessions", json=market.payload)
    assert response.status_code == 201, response.text
    return response.json()


def publish_offer(market):
    row = create_offer(market)
    response = market.client.post(P + f"/sessions/{row['id']}/publish", json={})
    assert response.status_code == 200, response.text
    return row


def test_student_enrolls_receives_persisted_receipt_and_cancels(market):
    row = publish_offer(market)
    market.as_user("student")

    listed = market.client.get(
        P + f"/sessions?subject_id={market.ids['subject']}"
    ).json()
    assert [item["id"] for item in listed] == [row["id"]]
    assert listed[0]["subject_name"] == "subject"
    assert listed[0]["enrolled_count"] == 0

    receipt = market.client.post(P + f"/sessions/{row['id']}/enroll", json={})
    assert receipt.status_code == 201, receipt.text
    body = receipt.json()
    assert body["status"] == "confirmed"
    assert body["simulated"] is True
    assert body["transaction"] == {
        "id": body["transaction"]["id"],
        "amount_cents": 2500,
        "commission_cents": 375,
        "currency": "BRL",
        "status": "completed",
        "simulated": True,
    }

    duplicate = market.client.post(P + f"/sessions/{row['id']}/enroll", json={})
    assert duplicate.status_code == 409
    assert "inscrição ativa" in duplicate.json()["detail"]

    bookings = market.client.get(P + "/bookings/mine")
    assert bookings.status_code == 200
    assert bookings.json()[0]["status"] == "confirmed"
    assert bookings.json()[0]["transaction"]["amount_cents"] == 2500

    cancelled = market.client.request("DELETE", P + f"/sessions/{row['id']}/enroll")
    assert cancelled.status_code == 204
    assert market.client.get(P + "/bookings/mine").json()[0]["status"] == "cancelled"
    assert market.connection.scalar(
        text("SELECT status FROM session_bookings WHERE session_id=:session"),
        {"session": row["id"]},
    ) == "cancelled"


def test_capacity_is_decided_by_server(market):
    row = publish_offer(market)
    market.connection.execute(
        text("UPDATE tutor_sessions SET capacity=1 WHERE id=:session"),
        {"session": row["id"]},
    )

    market.as_user("student")
    first = market.client.post(P + f"/sessions/{row['id']}/enroll", json={})
    assert first.status_code == 201, first.text

    market.as_user("other")
    second = market.client.post(P + f"/sessions/{row['id']}/enroll", json={})
    assert second.status_code == 409
    assert "lotada" in second.json()["detail"]
