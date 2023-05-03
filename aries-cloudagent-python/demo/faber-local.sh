#!/bin/bash
# this runs the Faber example as a local instace of instance of aca-py
# you need to run a local von-network (in the von-network directory run "./manage start <your local ip> --logs")
# ... and you need to install the local aca-py python libraries locally ("pip install -r ../requirements.txt -r ../requirements.indy.txt -r ../requirements.bbs.txt")

# the following will auto-respond on connection and credential requests, but not proof requests
PYTHONPATH=.. ../bin/aca-py start \
   --endpoint https://abc2-103-103-98-36.ngrok-free.app \
   --label faber.agent \
   --inbound-transport http 0.0.0.0 8020 \
   --outbound-transport http \
   --admin 0.0.0.0 8021 \
   --admin-insecure-mode \
   --wallet-type indy \
   --wallet-name faber.agent916333 \
   --wallet-key faber.agent916333 \
   --preserve-exchange-records \
   --auto-provision \
   --seed aF5s4d4bkfhvolsdf135A5sdf3Sfsf46 \
   --genesis-url http://dev.greenlight.bcovrin.vonx.io/genesis \
   --trace-target log \
   --trace-tag acapy.events \
   --trace-label faber.agent.trace \
   --auto-ping-connection \
   --auto-respond-messages \
   --auto-accept-invites \
   --auto-accept-requests \
   --auto-respond-credential-proposal \
   --auto-respond-credential-offer \
   --auto-respond-credential-request \
   --auto-respond-presentation-proposal \
   --auto-respond-presentation-request \
   --auto-verify-presentation \
   --auto-store-credential \
   --webhook-url https://d76e-103-103-98-36.ngrok-free.app/webhooks \

# set these for full auto
#   --auto-respond-presentation-proposal \
#   --auto-respond-presentation-request \
#   --auto-verify-presentation \
