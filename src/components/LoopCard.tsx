import type { Asset } from "../types/asset";

// Compact loop summary card for the library grid (aligns with reference site).
// The body opens the loop; the footer exposes quick actions (publish toggle,
// duplicate) without nesting interactive elements in a single button.
export default function LoopCard({
  asset,
  onOpen,
  onTogglePublish,
  onDuplicate,
  isFavorite,
  onToggleFavorite,
  lastUsedLabel,
}: {
  asset: Asset;
  onOpen: () => void;
  onTogglePublish?: () => void;
  onDuplicate?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  lastUsedLabel?: string;
}) {
  const isPublic = asset.visibility === "public";
  return (
    <div className="card">
      <div className="card__body" role="button" tabIndex={0} onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onOpen();
        }}
      >
        <div className="card__top">
          <span className="badge">{asset.kind}</span>
          <span className={`badge badge--${asset.visibility}`}>
            {asset.visibility}
          </span>
        </div>
        <h3 className="card__title">{asset.title}</h3>
        {asset.description && <p className="card__desc">{asset.description}</p>}
        <div className="card__tags">
          {asset.tags.slice(0, 4).map((t) => (
            <span key={t} className="tag">
              #{t}
            </span>
          ))}
        </div>
      </div>
      {(onTogglePublish || onDuplicate) && (
        <div className="card__actions">
          {onToggleFavorite && (
            <button
              className={`btn btn--mini btn--ghost card__fav${isFavorite ? " is-fav" : ""}`}
              onClick={onToggleFavorite}
              title={isFavorite ? "取消收藏" : "收藏"}
            >
              {isFavorite ? "★" : "☆"}
            </button>
          )}
          {asset.stats.copies > 0 && (
            <span className="card__stat">↻ {asset.stats.copies}</span>
          )}
          {lastUsedLabel && (
            <span className="card__stat">{lastUsedLabel}</span>
          )}
          <span className="card__spacer" />
          {onDuplicate && (
            <button
              className="btn btn--mini btn--ghost"
              onClick={onDuplicate}
              title="复制为新 Loop"
            >
              复制
            </button>
          )}
          {onTogglePublish && (
            <button
              className="btn btn--mini"
              onClick={onTogglePublish}
              title={isPublic ? "设为私有" : "发布为公开"}
            >
              {isPublic ? "设为私有" : "发布"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
