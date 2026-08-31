import { useState } from "react";

import type { Campaign } from "../../state/campaign-store";
import { CampaignChatRoomList } from "./CampaignChatRoomList";
import { CampaignChatRoomThread } from "./CampaignChatRoomThread";
import "./campaign-chat-room.css";
import { projectCampaignChatRooms } from "./campaign-chat-rooms";

interface CampaignChatDrawerProps {
  readonly campaign: Campaign;
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onSendChat: (targetNationId: string, message: string) => Promise<boolean>;
  /**
   * Ordered multilateral send seam. When absent the drawer degrades to the bilateral
   * `onSendChat` contract and only the first participant receives the message.
   */
  readonly onSendGroupChat?:
    | ((targetNationIds: readonly string[], message: string) => Promise<boolean>)
    | undefined;
}

export const CampaignChatDrawer = ({
  campaign,
  nationNameById,
  busy,
  onClose,
  onSendChat,
  onSendGroupChat,
}: CampaignChatDrawerProps): JSX.Element => {
  const targetNations = campaign.nations.filter((nation) => nation.id !== campaign.playerNationId);
  const rooms = projectCampaignChatRooms({
    messages: campaign.chatMessages,
    playerNationId: campaign.playerNationId,
    currentTurn: campaign.turn,
  });
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [startingNew, setStartingNew] = useState(false);
  const [newParticipantNationIds, setNewParticipantNationIds] = useState<readonly string[]>(() =>
    targetNations[0] === undefined ? [] : [targetNations[0].id],
  );
  const [readRoomKeys, setReadRoomKeys] = useState<ReadonlySet<string>>(() => new Set());
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const visibleRooms = rooms.map((room) =>
    readRoomKeys.has(`${campaign.turn}:${room.id}`) ? { ...room, unreadCount: 0 } : room,
  );
  const showThread = startingNew || selectedRoom !== undefined;

  const sendToParticipants = async (
    targetNationIds: readonly string[],
    message: string,
  ): Promise<boolean> => {
    const [primaryNationId] = targetNationIds;
    if (primaryNationId === undefined) {
      return false;
    }
    const sent =
      onSendGroupChat === undefined
        ? await onSendChat(primaryNationId, message)
        : await onSendGroupChat(targetNationIds, message);
    if (sent && startingNew) {
      setStartingNew(false);
      setSelectedRoomId(null);
    }
    return sent;
  };

  return (
    <aside className="chat_drawer" aria-label="외교 채팅" data-testid="chat-drawer">
      <div className="chat_drawer_heading">
        <div>
          <span className="eyebrow">상시 외교 통신</span>
          <h2>협상 채팅</h2>
        </div>
        <button className="quiet_button" data-testid="close-chat" type="button" onClick={onClose}>
          닫기
        </button>
      </div>
      {showThread ? (
        <CampaignChatRoomThread
          campaign={campaign}
          room={selectedRoom}
          nationNameById={nationNameById}
          participantNationIds={newParticipantNationIds}
          busy={busy}
          startingNew={startingNew}
          onBack={() => {
            setSelectedRoomId(null);
            setStartingNew(false);
          }}
          onSelectPrimaryParticipant={(nationId) => setNewParticipantNationIds([nationId])}
          onToggleParticipant={(nationId) =>
            setNewParticipantNationIds((current) =>
              current.includes(nationId)
                ? current.filter((participantId) => participantId !== nationId)
                : [...current, nationId],
            )
          }
          onSendChat={sendToParticipants}
        />
      ) : (
        <CampaignChatRoomList
          rooms={visibleRooms}
          nationNameById={nationNameById}
          playerNationId={campaign.playerNationId}
          onOpenRoom={(roomId) => {
            setReadRoomKeys((current) => new Set([...current, `${campaign.turn}:${roomId}`]));
            setSelectedRoomId(roomId);
          }}
          onStartChat={() => setStartingNew(true)}
        />
      )}
    </aside>
  );
};
