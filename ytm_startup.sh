#!/bin/bash

cd ~/python/ytm_playlist_manager/ || exit;

git pull origin main;

psql -d ytm < ~/python/ytm_playlist_manager/sql/create_tables.sql

tmux new -s react_ytm -d "cd ~/python/ytm_playlist_manager/frontend_ytm; yarn start"
tmux new -s flask_ytm -d "cd ~/python/ytm_playlist_manager/; python3 flask_app/flask_app.py"