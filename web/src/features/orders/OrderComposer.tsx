import { useState } from "react";

interface OrderComposerProps {
  readonly busy: boolean;
  readonly error: string | null;
  readonly onSubmit: (orderText: string) => Promise<boolean>;
}

export const OrderComposer = ({ busy, error, onSubmit }: OrderComposerProps): JSX.Element => {
  const [orderText, setOrderText] = useState("");
  const [actions, setActions] = useState<readonly string[]>([]);

  const addAction = (): void => {
    const trimmed = orderText.trim();
    if (trimmed.length === 0) {
      return;
    }
    setActions((current) => [...current, trimmed]);
    setOrderText("");
  };

  const brainstorm = (): void => {
    setOrderText((current) =>
      current.trim().length === 0
        ? "철도망을 확장하고 주변 국가와 통상 조건을 협상한다"
        : `${current.trim()} 그리고 다음 분기 실행 순서를 검토한다`,
    );
  };

  const polish = (): void => {
    setOrderText((current) => current.trim().replace(/\s+/g, " "));
    setActions((current) => current.map((action) => action.trim().replace(/\s+/g, " ")));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if ((orderText.trim().length === 0 && actions.length === 0) || busy) {
      return;
    }
    const combinedOrder = [...actions, orderText.trim()].join(" 그리고 ");
    const committed = await onSubmit(combinedOrder);
    if (committed) {
      setOrderText("");
      setActions([]);
    }
  };

  return (
    <form className="order_composer" onSubmit={submit}>
      <div className="composer_header">
        <h2>다음 명령</h2>
        <span>결정론적 검증</span>
      </div>
      <textarea
        className="order_input"
        data-testid="order-input"
        value={orderText}
        onChange={(event) => setOrderText(event.target.value)}
        placeholder="예: 철도망을 확장하고 일본에 통상 협정을 제안한다"
        aria-label="다음 전략 명령"
        maxLength={4000}
      />
      <fieldset className="order_workbench_actions">
        <legend>명령 편집 도구</legend>
        <button
          className="quiet_button"
          data-testid="brainstorm-order"
          type="button"
          onClick={brainstorm}
          disabled={busy}
        >
          브레인스토밍
        </button>
        <button
          className="quiet_button"
          data-testid="polish-order"
          type="button"
          onClick={polish}
          disabled={busy || (orderText.trim().length === 0 && actions.length === 0)}
        >
          문장 다듬기
        </button>
        <button
          className="quiet_button"
          data-testid="add-order-action"
          type="button"
          onClick={addAction}
          disabled={busy || (orderText.trim().length === 0 && actions.length === 0)}
        >
          행동 추가
        </button>
      </fieldset>
      {actions.length > 0 ? (
        <ol className="order_action_list" data-testid="order-action-list">
          {actions.map((action, index) => (
            <li key={action}>
              <input
                data-testid={`order-action-${index}`}
                value={action}
                aria-label={`행동 ${index + 1}`}
                onChange={(event) =>
                  setActions((current) =>
                    current.map((currentAction, currentIndex) =>
                      currentIndex === index ? event.target.value : currentAction,
                    ),
                  )
                }
              />
              <button
                className="quiet_button"
                data-testid={`remove-order-action-${index}`}
                type="button"
                onClick={() => setActions((current) => current.filter((_, i) => i !== index))}
              >
                삭제
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="order_footer">
        <span className="order_hint">비용과 외교 결과를 확인한 뒤 턴을 확정합니다.</span>
        <button
          className="primary_button"
          data-testid="advance-turn"
          type="submit"
          disabled={busy || orderText.trim().length === 0}
        >
          {busy ? "분석 중…" : "턴 확정"}
        </button>
      </div>
      {error !== null ? (
        <div className="error_banner" role="alert">
          {error}
        </div>
      ) : null}
    </form>
  );
};
