#!/bin/sh

git fetch

UPSTREAM=${1:-'@{u}'}
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse "$UPSTREAM")
BASE=$(git merge-base @ "$UPSTREAM")

if [ $LOCAL = $REMOTE ]; then
    exit;
elif [ $LOCAL = $BASE ]; then
    exit;
elif [ $REMOTE = $BASE ]; then
    exit;
else
    git pull --rebase
    if [ $? -ne 0 ]; then
        ./send_error_git_mail.sh
        git rebase --abort
    else
        make stop
        make daemon
    fi
fi

