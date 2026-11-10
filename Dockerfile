FROM alpine:3.23

RUN apk add --no-cache sqlite

CMD ["sqlite3", "/data/warehouse.db"]
