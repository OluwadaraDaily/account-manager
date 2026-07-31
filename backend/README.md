# Account Manager backend

This directory contains the server-side OAuth, Gmail import, and asynchronous job code.

The current scaffold exposes only a typed health endpoint. OAuth, persistent sessions, Gmail
access, and background jobs will be added in later steps.

The backend may process Gmail content transiently during an active import, but it must not
persist raw messages, bodies, attachments, or unrelated bank data. It may persist only normalized
transactions extracted from banks explicitly selected by the user.
