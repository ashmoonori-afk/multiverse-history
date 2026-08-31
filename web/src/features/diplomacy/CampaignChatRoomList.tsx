import type { CampaignChatRoom } from "./campaign-chat-rooms";

interface CampaignChatRoomListProps {
  readonly rooms: readonly CampaignChatRoom[];
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly playerNationId: string;
  readonly onOpenRoom: (roomId: string) => void;
  readonly onStartChat: () => void;
}

const formatDate = (date: CampaignChatRoom["latestDate"]): string =>
  `${date.year}년 ${date.quarter}분기`;

const nationMark = (nationName: string): string => nationName.slice(0, 1);

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
            const counterpartName =
              nationNameById.get(room.counterpartNationId) ?? room.counterpartNationId;
            return (
              <section className="chat_room_group" key={room.id}>
                {dateLabel === previousDate ? null : (
                  <div className="chat_room_date">
                    <span>{dateLabel}</span>
                  </div>
                )}
                <button
                  className="chat_room_card"
                  data-testid="chat-room"
                  type="button"
                  aria-label={`${counterpartName} ${room.subjectKo} 채팅 열기${
                    room.unreadCount > 0 ? `, 읽지 않은 메시지 ${room.unreadCount}개` : ""
                  }`}
                  onClick={() => onOpenRoom(room.id)}
                >
                  <span className="chat_room_marks" aria-hidden="true">
                    <span>{nationMark(playerName)}</span>
                    <span>{nationMark(counterpartName)}</span>
                  </span>
                  <span className="chat_room_copy">
                    <strong>
                      {counterpartName} · {room.subjectKo}
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
