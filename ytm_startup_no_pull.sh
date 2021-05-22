#!/bin/bash

cd ~/python/playlist_manager/ || exit;

echo "KILLING TMUX"
tmux kill-session -t react_ytm
tmux kill-session -t flask_ytm

echo "STARTING TMUX"
tmux new -s react_ytm -d "cd ~/python/playlist_manager/frontend_ytm; yarn start"
tmux new -s flask_ytm -d "cd ~/python/playlist_manager/flask_app; python3 flask_app.py"
