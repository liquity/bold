### Patched OpenZeppelin contracts

The only way we can migrate our StableToken implementation to a modern one is if we can keep the same storage layout in the proxy.
Sadly our tokens aren't compatible with the OZ ERC20 out of the box. We can use the `bin/storage-show.sh` command to get a quick view of the storage layout:

```
> ./bin/storage-show.sh StableToken
0   0   _owner              t_address
0   20  initialized         t_bool
1   0   registry            t_contract(IRegistry)4167
2   0   name_               t_string_storage
3   0   symbol_             t_string_storage
4   0   decimals_           t_uint8
5   0   balances            t_mapping(t_address,t_uint256)
6   0   totalSupply_        t_uint256
7   0   allowed             t_mapping(t_address,t_mapping(t_address,t_uint256))
8   0   inflationState      t_struct(InflationState)10264_storage
12  0   exchangeRegistryId  t_bytes32
⏎
```

To make this work I copied the contracts from version `v4.8.0` here and modified the order of storage variables in order to get to something that's compatible:

```
> ./bin/storage-show.sh ERC20Upgradeable
0  0   _owner                                t_address
0  20  _initialized                          t_uint8
0  21  _initializing                         t_bool
1  0   __deprecated_registry_storage_slot__  t_address
2  0   _name                                 t_string_storage
3  0   _symbol                               t_string_storage
4  0   __deprecated_decimals_storage_slot__  t_uint8
5  0   _balances                             t_mapping(t_address,t_uint256)
6  0   _totalSupply                          t_uint256
7  0   _allowances                           t_mapping(t_address,t_mapping(t_address,t_uint256))
8  0   __gap                                 t_array(t_uint256)45_storage
```

> Note: The columns of the table are: slot, offset, name, type

The `initialized` bool upgrades nicely to the new `Initializable` structure in more recent OZ - it was designed this way.
We reserve some deprecated slots, and make sure the others match up 1:1. The name being different is not an issue.

And which can then be used in `ERC20Permit` and `StableTokenV2` to finally come up with this:

```
> ./bin/storage-show.sh StableTokenV2
0    0   _owner                                          t_address
0    20  _initialized                                    t_uint8
0    21  _initializing                                   t_bool
1    0   __deprecated_registry_storage_slot__            t_address
2    0   _name                                           t_string_storage
3    0   _symbol                                         t_string_storage
4    0   __deprecated_decimals_storage_slot__            t_uint8
5    0   _balances                                       t_mapping(t_address,t_uint256)
6    0   _totalSupply                                    t_uint256
7    0   _allowances                                     t_mapping(t_address,t_mapping(t_address,t_uint256))
8    0   __deeprecated_inflationState_storage_slot__     t_array(t_uint256)4_storage
12   0   __deprecated_exchangeRegistryId_storage_slot__  t_bytes32
13   0   __gap                                           t_array(t_uint256)40_storage
53   0   _HASHED_NAME                                    t_bytes32
54   0   _HASHED_VERSION                                 t_bytes32
55   0   __gap                                           t_array(t_uint256)50_storage
105  0   _nonces                                         t_mapping(t_address,t_struct(Counter)51157_storage)
106  0   _PERMIT_TYPEHASH_DEPRECATED_SLOT                t_bytes32
107  0   __gap                                           t_array(t_uint256)49_storage
156  0   validators                                      t_address
157  0   broker                                          t_address
158  0   exchange                                        t_address
```

In this new implementation we also remove the dependency on the `Registry` and introduce the 3 new storage variables to store addresses for the dependencies directly.
See the `test/integration/TokenUpgrade.t.sol` for a simulation of switching the implementation of an existing live token in a forked environment.

In the future, if we want to migrate to newer versions of this we can go through the same process of copying the files and patching them to keep the storage layout consistent.
