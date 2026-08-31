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
}

export const CampaignChatDrawer = ({
  campaign,
  nationNameById,
  busy,
  onClose,
  onSendChat,
}: CampaignChatDrawerProps): JSX.Element => {
  const targetNations = campaign.nations.filter((nation) => nation.id !== campaign.playerNationId);
  const rooms = projectCampaignChatRooms({
    messages: campaign.chatMessages,
    playerNationId: campaign.playerNationId,
    currentTurn: campaign.turn,
  });
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [startingNew, setStartingNew] = useState(false);
  const [newTargetNationId, setNewTargetNationId] = useState(targetNations[0]?.id ?? "");
  const [readRoomKeys, setReadRoomKeys] = useState<ReadonlySet<string>>(() => new Set());
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const visibleRooms = rooms.map((room) =>
    readRoomKeys.has(`${campaign.turn}:${room.id}`) ? { ...room, unreadCount: 0 } : room,
  );
  const targetNationId = selectedRoom?.counterpartNationId ?? newTargetNationId;
  const showThread = startingNew || selectedRoom !== undefined;

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
          targetNationId={targetNationId}
          busy={busy}
          startingNew={startingNew}
          onBack={() => {
            setSelectedRoomId(null);
            setStartingNew(false);
          }}
          onChangeTarget={setNewTargetNationId}
          onSendChat={async (nationId, message) => {
            const sent = await onSendChat(nationId, message);
            if (sent && startingNew) {
              setStartingNew(false);
              setSelectedRoomId(null);
            }
            return sent;
          }}
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
