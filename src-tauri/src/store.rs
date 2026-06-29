//! Local-first persistence for assets, backed by SQLite (bundled rusqlite).
//!
//! The full asset is stored as a JSON document in `data`; a handful of columns
//! are denormalized for cheap filtering/sorting. This keeps the schema stable
//! as new asset kinds are introduced.

use std::path::Path;
use std::sync::Mutex;

use rusqlite::{params, Connection};

use crate::model::Asset;

pub struct Store(pub Mutex<Connection>);

impl Store {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS assets (
                id          TEXT PRIMARY KEY,
                kind        TEXT NOT NULL,
                title       TEXT NOT NULL,
                slug        TEXT NOT NULL,
                visibility  TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                data        TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets(kind);
            CREATE TABLE IF NOT EXISTS settings (
                k  TEXT PRIMARY KEY,
                v  TEXT NOT NULL
            );",
        )?;
        Ok(Self(Mutex::new(conn)))
    }

    pub fn list(&self, kind: Option<&str>) -> Result<Vec<Asset>, String> {
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        let mut rows: Vec<String> = Vec::new();
        match kind {
            Some(k) => {
                let mut stmt = conn
                    .prepare("SELECT data FROM assets WHERE kind = ?1 ORDER BY updated_at DESC")
                    .map_err(|e| e.to_string())?;
                let mapped = stmt
                    .query_map(params![k], |row| row.get::<_, String>(0))
                    .map_err(|e| e.to_string())?;
                for r in mapped {
                    rows.push(r.map_err(|e| e.to_string())?);
                }
            }
            None => {
                let mut stmt = conn
                    .prepare("SELECT data FROM assets ORDER BY updated_at DESC")
                    .map_err(|e| e.to_string())?;
                let mapped = stmt
                    .query_map([], |row| row.get::<_, String>(0))
                    .map_err(|e| e.to_string())?;
                for r in mapped {
                    rows.push(r.map_err(|e| e.to_string())?);
                }
            }
        }
        rows.into_iter()
            .map(|s| serde_json::from_str::<Asset>(&s).map_err(|e| e.to_string()))
            .collect()
    }

    pub fn get(&self, id: &str) -> Result<Option<Asset>, String> {
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT data FROM assets WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt.query(params![id]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let data: String = row.get(0).map_err(|e| e.to_string())?;
            let asset = serde_json::from_str::<Asset>(&data).map_err(|e| e.to_string())?;
            Ok(Some(asset))
        } else {
            Ok(None)
        }
    }

    pub fn upsert(&self, asset: &Asset) -> Result<(), String> {
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        let data = serde_json::to_string(asset).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO assets (id, kind, title, slug, visibility, updated_at, data)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
                kind = excluded.kind,
                title = excluded.title,
                slug = excluded.slug,
                visibility = excluded.visibility,
                updated_at = excluded.updated_at,
                data = excluded.data",
            params![
                asset.id,
                asset.kind,
                asset.title,
                asset.slug,
                asset.visibility,
                asset.updated_at,
                data,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM assets WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Increments an asset's `stats.copies` counter without touching its
    /// `updated_at` (so running a loop doesn't reorder the library).
    pub fn bump_copies(&self, id: &str) -> Result<(), String> {
        if let Some(mut asset) = self.get(id)? {
            asset.stats.copies += 1;
            self.upsert(&asset)?;
        }
        Ok(())
    }

    /// Reads a settings value by key, if present.
    pub fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT v FROM settings WHERE k = ?1")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt.query(params![key]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            Ok(Some(row.get::<_, String>(0).map_err(|e| e.to_string())?))
        } else {
            Ok(None)
        }
    }

    /// Inserts or replaces a settings value.
    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO settings (k, v) VALUES (?1, ?2)
             ON CONFLICT(k) DO UPDATE SET v = excluded.v",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Deletes every asset (used by the "clear local data" setting).
    pub fn clear_assets(&self) -> Result<(), String> {
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM assets", [])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn count(&self) -> Result<i64, String> {
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        conn.query_row("SELECT COUNT(*) FROM assets", [], |row| row.get(0))
            .map_err(|e| e.to_string())
    }
}
