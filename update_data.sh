export PYTHONPATH='/home/matt/python/playlist_manager/flask_app/:/home/matt/python/playlist_manager/flask_app/cache:/home/matt/python/playlist_manager/flask_app/db:/home/matt/python/playlist_manager/flask_app/ytm_api'; 
export PYTHONPATH='$PYTHONPATH:/home/matt/java/mhub4/gather/'; 
echo $PYTHONPATH; 
python3 /home/matt/python/playlist_manager/flask_app/cache/update_cache.py
