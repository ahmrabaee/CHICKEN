-- =============================================================================
-- Migration 012: JournalEntryLine isRoundOff (Blueprint 02)
-- For UI indicator of round-off lines
-- =============================================================================

ALTER TABLE journal_entry_lines ADD COLUMN is_round_off INTEGER DEFAULT 0;
