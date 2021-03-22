create table if not exists thumbnail(
    id varchar unique,
    primary key (id)
);

create table if not exists thumbnail_download(
    thumbnail_id varchar references thumbnail(id) on delete cascade ,
    downloaded boolean,
    size int,
    filepath varchar,
    primary key (thumbnail_id, size)
);

create table if not exists playlist (
    id varchar unique,
    name varchar,
    thumbnail_id varchar references thumbnail(id) on delete cascade
);

create table if not exists artist (
    id varchar unique,
    name varchar,
    thumbnail_id varchar references thumbnail(id) on delete cascade
);

create table if not exists album (
    id varchar unique,
    name varchar,
    thumbnail_id varchar references thumbnail(id) on delete cascade
);

create table if not exists song(
    id varchar unique,
    name varchar,
    album_id varchar references album(id),
    length varchar,
    explicit boolean,
    is_local boolean
);

create table if not exists artist_songs(
    song_id varchar references song(id) on delete cascade,
    artist_id varchar references artist(id) on delete cascade,
    primary key (song_id, artist_id)
);


create table if not exists songs_in_playlist(
    playlist_id varchar references playlist(id) on delete cascade,
    song_id varchar references song(id) on delete cascade,
    set_video_id varchar ,
    datetime_added int,
    index int,
    primary key (playlist_id, set_video_id)
);

create type data_type as enum ('playlist', 'song', 'album', 'artist', 'thumbnail', 'library');

create table if not exists data_cache(
    data_id varchar,
    data_type data_type,
    timestamp integer,
    constraint unique_id_and_type unique (data_id, data_type)
);

create table if not exists playlist_song_duplicates(
    playlist_id varchar references playlist(id) on delete cascade,
    song_id varchar references song(id) on delete cascade,
    set_video_id varchar
);

create type action_type as enum('add_song', 'remove_song', 'create_playlist', 'delete_playlist') ;

create table playlist_action_log(
    action_type action_type not null,
    timestamp int,
    done_through_ytm boolean,
    was_success boolean,
    playlist_id varchar references playlist(id) null,
    playlist_name varchar null,
    song_id varchar references song(id) null,
    song_name varchar null
);