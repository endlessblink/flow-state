#!/bin/sh
# Kong entrypoint — substitute env vars in config template
# Based on the official Supabase kong-entrypoint.sh

# Substitute all $VAR_NAME patterns from environment
awk '{
  result = ""
  rest = $0
  while (match(rest, /\$[A-Za-z_][A-Za-z_0-9]*/)) {
    varname = substr(rest, RSTART + 1, RLENGTH - 1)
    if (varname in ENVIRON) {
      result = result substr(rest, 1, RSTART - 1) ENVIRON[varname]
    } else {
      result = result substr(rest, 1, RSTART + RLENGTH - 1)
    }
    rest = substr(rest, RSTART + RLENGTH)
  }
  print result rest
}' /var/lib/kong/kong.yml.template > /tmp/kong.yml

# Remove entries with empty key values
sed -i '/^[[:space:]]*- key:[[:space:]]*$/d' /tmp/kong.yml

export KONG_DECLARATIVE_CONFIG=/tmp/kong.yml
exec /docker-entrypoint.sh kong docker-start
