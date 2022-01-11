### setup

create a keypair to use as the authorized account:

    npm run make-auth-key

choose your network

    solana config set --url localhost


start the local validator

    solana-test-validator


install dependencies of client scripts

    npm run install-client-deps


### running

build & deploy your contract

    npm run build-and-deploy

run one of the clients

#### Echo:

    npm run echo

#### AuthorizedEcho:

    npm run authEcho

#### Vending Machine Echo:

    npm run vendingMachineEcho

    

    