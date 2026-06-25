CREATE TABLE IF NOT EXISTS reading_list (
    work_id    VARCHAR PRIMARY KEY,
    status     VARCHAR DEFAULT 'unread',
    added_at   TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
