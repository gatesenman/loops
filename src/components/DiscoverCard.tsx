import type { Asset } from "../types/asset";

// A platform loop card in the Discover tab. Read-only preview with an Import
// action that clones the loop into the user's local library.
export default function DiscoverCard({
  asset,
  imported,
  onImport,
}: {
  asset: Asset;
  imported: boolean;
  onImport: () => void;
}) {
  const trigger = asset.triggers[0];
  return (
    <div className="card">
      <div className="card__body">
        <div className="card__top">
          {asset.author && <span className="badge">@{asset.author}</span>}
          {trigger && (
            <span className="badge">
              {trigger.trigger}
              {trigger.keyword}
            </span>
          )}
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
      <div className="card__actions">
        <span className="card__stat">↻ {asset.stats.copies}</span>
        <span className="card__stat">♥ {asset.stats.likes}</span>
        <span className="card__spacer" />
        <button
          className="btn btn--mini"
          onClick={onImport}
          disabled={imported}
        >
          {imported ? "已导入 ✓" : "导入"}
        </button>
      </div>
    </div>
  );
}
