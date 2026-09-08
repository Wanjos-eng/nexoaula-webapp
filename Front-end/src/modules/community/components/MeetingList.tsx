import { CalendarBlank, Check, MapPin } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useState } from "react";
import type { GroupMeeting } from "@/modules/community/types";

import styles from "./GroupDetailView.module.css";

type MeetingListProps = {
  meeting?: GroupMeeting;
  onViewMeetings?: () => void;
};

export function MeetingList({ meeting, onViewMeetings }: MeetingListProps) {
  const [interested, setInterested] = useState(false);
  const [feedback, setFeedback] = useState("");

  function toggleInterest() {
    const nextState = !interested;
    setInterested(nextState);
    setFeedback(
      nextState
        ? "Interesse registrado no protótipo."
        : "Interesse removido do protótipo.",
    );
  }

  if (!meeting) {
    return (
      <section className={styles.sideCard} id="encontro">
        <div className={styles.sideHeading}>
          <h3>Próximo encontro</h3>
        </div>
        <p className={styles.emptyText}>Nenhum encontro agendado no momento.</p>
      </section>
    );
  }

  return (
    <section className={styles.sideCard} id="encontro">
      <div className={styles.sideHeading}>
        <h3>Próximo encontro</h3>
        <span>{meeting.mode === "online" ? "Online" : "Presencial"}</span>
      </div>
      <h4>{meeting.title}</h4>
      <p>
        <CalendarBlank aria-hidden size={16} /> {meeting.date}, {meeting.time}
      </p>
      <p>
        <MapPin aria-hidden size={16} /> {meeting.location}
      </p>
      <button
        aria-pressed={interested}
        className={interested ? styles.interestActive : styles.interest}
        onClick={toggleInterest}
        type="button"
      >
        {interested ? (
          <>
            <Check aria-hidden size={17} /> Interesse confirmado
          </>
        ) : (
          "Tenho interesse"
        )}
      </button>
      {feedback ? (
        <p aria-live="polite" className={styles.simulatedNotice}>
          {feedback}
        </p>
      ) : null}
      {onViewMeetings ? (
        <button className={styles.details} onClick={onViewMeetings} type="button">
          Ver detalhes do encontro
        </button>
      ) : (
        <Link className={styles.details} href="#encontro">
          Ver detalhes do encontro
        </Link>
      )}
    </section>
  );
}
