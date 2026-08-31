import type { CampaignChatRoom } from "./campaign-chat-rooms";

interface CampaignChatRoomListProps {
  readonly rooms: readonly CampaignChatRoom[];
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly playerNationId: string;
  readonly onOpenRoom: (roomId: string) => void;
  readonly onStartChat: () => void;
}

interface CampaignChatRoomCardProps {
  readonly room: CampaignChatRoom;
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly playerName: string;
  readonly onOpen: () => void;
}

const formatDate = (date: CampaignChatRoom["latestDate"]): string =>
  `${date.year}년 ${date.quarter}분기`;

const nationMark = (nationName: string): string => nationName.slice(0, 1);

const CampaignChatRoomCard = ({
  room,
  nationNameById,
  playerName,
  onOpen,
}: CampaignChatRoomCardProps): JSX.Element => {
  const counterpartNames = room.counterpartNationIds.map(
    (nationId) => nationNameById.get(nationId) ?? nationId,
  );
  const counterpartLabel = counterpartNames.join(" · ");
  const participantCount = counterpartNames.length + 1;
  const unreadLabel = room.unreadCount > 0 ? `, 읽지 않은 메시지 ${room.unreadCount}개` : "";

  return (
    <button
      className="chat_room_card"
      data-testid="chat-room"
      data-room-id={room.id}
      data-participant-count={participantCount}
      type="button"
      aria-label={`${counterpartLabel} ${room.subjectKo} 채팅 열기${unreadLabel}`}
      onClick={onOpen}
    >
      <span className="chat_room_marks" aria-hidden="true">
        <span>{nationMark(playerName)}</span>
        <span>{nationMark(counterpartLabel)}</span>
      </span>
      <span className="chat_room_copy">
        <strong>
          {participantCount > 2 ? (
            <em className="chat_room_participant_count">{participantCount}자</em>
          ) : null}
          {counterpartLabel} · {room.subjectKo}
        </strong>
        <span>{room.previewKo}</span>
      </span>
      <span className="chat_room_status">
        <span>턴 {room.latestTurn}</span>
        {room.unreadCount > 0 ? (
          <strong data-testid="chat-room-unread">{room.unreadCount}</strong>
        ) : null}
        <span aria-hidden="true">›</span>
      </span>
    </button>
  );
};

export const CampaignChatRoomList = ({
  rooms,
  nationNameById,
  playerNationId,
  onOpenRoom,
  onStartChat,
}: CampaignChatRoomListProps): JSX.Element => {
  const playerName = nationNameById.get(playerNationId) ?? playerNationId;

  return (
    <section className="chat_room_index" aria-label="외교 채팅룸 목록">
      <div className="chat_room_list" data-testid="chat-room-list">
        {rooms.length === 0 ? (
          <p className="chat_empty">아직 개설된 외교 채팅룸이 없습니다.</p>
        ) : (
          rooms.map((room, index) => {
            const previousRoom = rooms[index - 1];
            const dateLabel = formatDate(room.latestDate);
            const previousDate =
              previousRoom === undefined ? undefined : formatDate(previousRoom.latestDate);
            return (
              <section className="chat_room_group" key={room.id}>
                {dateLabel === previousDate ? null : (
                  <div className="chat_room_date">
                    <span>{dateLabel}</span>
                  </div>
                )}
                <CampaignChatRoomCard
                  room={room}
                  nationNameById={nationNameById}
                  playerName={playerName}
                  onOpen={() => onOpenRoom(room.id)}
                />
              </section>
            );
          })
        )}
      </div>
      <button
        className="chat_new_room_button"
        data-testid="new-chat"
        type="button"
        onClick={onStartChat}
      >
        새 채팅 시작
      </button>
    </section>
  );
};
