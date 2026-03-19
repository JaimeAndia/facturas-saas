#!/bin/bash
stripe listen \
  --forward-to localhost:3000/api/webhooks/stripe \
  --forward-connect-to localhost:3000/api/webhooks/stripe-connect
