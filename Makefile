# include .env file and export its env vars
# (-include to ignore error if it does not exist)
-include .env

# How to use $(EXTRA) or $(NETWORK)
# define it with your command. 
# e.g: make tests EXTRA='-vvv --match-contract MyContractTest'

# deps
update:; forge update
remappings:; forge remappings > remappings.txt

# commands
coverage :; export FOUNDRY_PROFILE=unit && forge coverage 
coverage-output :; export FOUNDRY_PROFILE=unit && forge coverage --report lcov
build  :; forge build --force 
clean  :; forge clean

# tests
tests   :; export FOUNDRY_PROFILE=unit && forge test $(EXTRA)
tests-e2e :; export FOUNDRY_PROFILE=e2e && forge test $(EXTRA)

# Gas Snapshots
snapshot :; forge snapshot $(EXTRA)
snapshot-fork :; forge snapshot --snap .gas-snapshot-fork $(RPC) $(EXTRA)

#Analytic Tools
slither :; slither --config-file ./slither-config.json src/

deploy :; forge script $(SCRIPT_NAME) --rpc-url $(RPC) --sig "run()" --broadcast --verify -vvvv $(EXTRA)
simulate-deploy :; forge script $(SCRIPT_NAME) --rpc-url $(RPC) --sig "run()" -vvvv $(EXTRA)