#!/bin/bash

cd ~/python/ytm_playlist_manager/ || exit;

echo "PULLING FROM GIT"
git pull origin main;

#echo "CREATING DB TABLES"
#psql -d ytm < ~/python/ytm_playlist_manager/sql/create_tables.sql

echo "KILLING TMUX"
tmux kill-session -t react_ytm
tmux kill-session -t flask_ytm

echo "STARTING TMUX"
tmux new -s react_ytm -d "cd ~/python/ytm_playlist_manager/frontend_ytm; yarn start"
tmux new -s flask_ytm -d "cd ~/python/ytm_playlist_manager/flask_app; python3 flask_app.py"