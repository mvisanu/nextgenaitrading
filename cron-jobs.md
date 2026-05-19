Active (running on startup)

┌──────────────────────┬──────────┬──────────────────┬────────────────────────────────────────────────────┐
  │        Job ID        │ Trigger  │   Interval /     │                    Description                     │  │                      │          │     Schedule     │                                                    │
  ├──────────────────────┼──────────┼──────────────────┼────────────────────────────────────────────────────┤
  │ evaluate_alerts      │ interval │ every 10 min     │ Evaluate user price-alert rules, fire              │
  │                      │          │                  │ notifications                                      │
  ├──────────────────────┼──────────┼──────────────────┼────────────────────────────────────────────────────┤
  │ evaluate_auto_buy    │ interval │ every 10 min     │ Execute matching auto-buy orders                   │
  ├──────────────────────┼──────────┼──────────────────┼────────────────────────────────────────────────────┤
  │ run_commodity_alerts │ interval │ every 30 min     │ 4-gate commodity signal engine + email/SMS alerts  │
  ├──────────────────────┼──────────┼──────────────────┼────────────────────────────────────────────────────┤
  │ btc_bot_monitor      │ interval │ every 15 min     │ BTC trailing-stop bot — FLOOR / trailing / ladder  │
  │                      │          │                  │ / cooldown                                         │
  ├──────────────────────┼──────────┼──────────────────┼────────────────────────────────────────────────────┤
  │ prune_old_signals    │ cron     │ daily 02:00 UTC  │ Prune stale buy_now_signals rows                   │
  └──────────────────────┴──────────┴──────────────────┴────────────────────────────────────────────────────┘

  ---
  Paused on startup (visible in /crons, not running)

  ┌─────────────────────────┬────────────────────────┬─────────────────────────────────────────────┐
  │         Job ID          │    Default Interval    │                 Description                 │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ refresh_buy_zones       │ 120 min                │ Refresh buy-zone snapshots                  │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ refresh_theme_scores    │ 720 min (12h)          │ Recompute per-theme composite scores        │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ scan_all_watchlists     │ 30 min                 │ Scan watchlists for buy/sell signals        │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ run_live_scanner        │ 15 min                 │ 10-condition buy-now scanner (market hours) │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ run_idea_generator      │ 120 min                │ Auto-generate idea cards                    │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ run_news_scanner        │ 120 min                │ RSS news warmup/logging                     │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ scan_all_watchlists     │ 30 min                 │ Scan watchlists for buy/sell signals        │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ run_live_scanner        │ 15 min                 │ 10-condition buy-now scanner (market hours) │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ refresh_buy_zones       │ 120 min                │ Refresh buy-zone snapshots                  │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ refresh_theme_scores    │ 720 min (12h)          │ Recompute per-theme composite scores        │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ scan_all_watchlists     │ 30 min                 │ Scan watchlists for buy/sell signals        │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ run_live_scanner        │ 15 min                 │ 10-condition buy-now scanner (market hours) │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ run_idea_generator      │ 120 min                │ Auto-generate idea cards                    │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ run_news_scanner        │ 120 min                │ RSS news warmup/logging                     │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ trailing_bot_monitor    │ 5 min                  │ Adjust trailing stops                       │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ wheel_bot_monitor       │ 15 min                 │ Advance wheel-strategy state machine        │
  ├─────────────────────────┼────────────────────────┼─────────────────────────────────────────────┤
  │ wheel_bot_daily_summary │ cron Mon–Fri 21:05 UTC │ EOD summary for wheel-bot sessions          │
  └─────────────────────────┴────────────────────────┴─────────────────────────────────────────────┘