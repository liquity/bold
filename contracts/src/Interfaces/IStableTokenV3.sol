// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.24;

/**
 * @title IStableTokenV3
 * @notice Interface for the StableTokenV3 contract.
 */
interface IStableTokenV3 {
    /**
     * @notice Checks if an address is a minter.
     * @param account The address to check.
     * @return bool True if the address is a minter, false otherwise.
     */
    function isMinter(address account) external view returns (bool);
    /**
     * @notice Checks if an address is a burner.
     * @param account The address to check.
     * @return bool True if the address is a burner, false otherwise.
     */
    function isBurner(address account) external view returns (bool);
    /**
     * @notice Checks if an address is an operator.
     * @param account The address to check.
     * @return bool True if the address is an operator, false otherwise.
     */
    function isOperator(address account) external view returns (bool);

    /**
     * @notice Initializes a StableTokenV3.
     * @param _name The name of the stable token (English)
     * @param _symbol A short symbol identifying the token (e.g. "cUSD")
     * @param _initialOwner The address that will be the owner of the contract.
     * @param initialBalanceAddresses Array of addresses with an initial balance.
     * @param initialBalanceValues Array of balance values corresponding to initialBalanceAddresses.
     * @param _minters The addresses that are allowed to mint.
     * @param _burners The addresses that are allowed to burn.
     * @param _operators The addresses that are allowed to call the operator functions.
     */
    function initialize(
        string calldata _name,
        string calldata _symbol,
        address _initialOwner,
        address[] calldata initialBalanceAddresses,
        uint256[] calldata initialBalanceValues,
        address[] calldata _minters,
        address[] calldata _burners,
        address[] calldata _operators
    ) external;

    /**
     * @notice Initializes a StableTokenV3 contract
     * when upgrading from StableTokenV2.sol.
     * It sets the addresses of the minters, burners, and operators.
     * @dev This function is only callable once.
     * @param _minters The addresses that are allowed to mint.
     * @param _burners The addresses that are allowed to burn.
     * @param _operators The addresses that are allowed to call the operator functions.
     */
    function initializeV3(address[] calldata _minters, address[] calldata _burners, address[] calldata _operators)
        external;

    /**
     * @notice Sets the operator role for an address.
     * @param _operator The address of the operator.
     * @param _isOperator The boolean value indicating if the address is an operator.
     */
    function setOperator(address _operator, bool _isOperator) external;

    /**
     * @notice Sets the minter role for an address.
     * @param _minter The address of the minter.
     * @param _isMinter The boolean value indicating if the address is a minter.
     */
    function setMinter(address _minter, bool _isMinter) external;

    /**
     * @notice Sets the burner role for an address.
     * @param _burner The address of the burner.
     * @param _isBurner The boolean value indicating if the address is a burner.
     */
    function setBurner(address _burner, bool _isBurner) external;

    /**
     * From openzeppelin's IERC20.sol
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * From openzeppelin's IERC20.sol
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * From openzeppelin's IERC20.sol
     * @dev Moves `amount` tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * From openzeppelin's IERC20.sol
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * From openzeppelin's IERC20.sol
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * From openzeppelin's IERC20.sol
     * @dev Moves `amount` tokens from `from` to `to` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    /**
     * @notice Mints new StableToken and gives it to 'to'.
     * @param to The account for which to mint tokens.
     * @param value The amount of StableToken to mint.
     */
    function mint(address to, uint256 value) external returns (bool);

    /**
     * @notice Burns StableToken from the balance of msg.sender.
     * @param value The amount of StableToken to burn.
     */
    function burn(uint256 value) external returns (bool);

    /**
     * @notice Burns StableToken from the balance of an account.
     * @param account The account to burn from.
     * @param value The amount of StableToken to burn.
     */
    function burn(address account, uint256 value) external returns (bool);

    /**
     * From openzeppelin's IERC20PermitUpgradeable.sol
     * @dev Sets `value` as the allowance of `spender` over ``owner``'s tokens,
     * given ``owner``'s signed approval.
     *
     * IMPORTANT: The same issues {IERC20-approve} has related to transaction
     * ordering also apply here.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `deadline` must be a timestamp in the future.
     * - `v`, `r` and `s` must be a valid `secp256k1` signature from `owner`
     * over the EIP712-formatted function arguments.
     * - the signature must use ``owner``'s current nonce (see {nonces}).
     *
     * For more information on the signature format, see the
     * https://eips.ethereum.org/EIPS/eip-2612#specification[relevant EIP
     * section].
     */
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external;

    /**
     * @notice Transfer token from a specified address to the stability pool.
     * @param _sender The address to transfer from.
     * @param _poolAddress The address of the pool to transfer to.
     * @param _amount The amount to be transferred.
     */
    function sendToPool(address _sender, address _poolAddress, uint256 _amount) external;

    /**
     * @notice Transfer token to a specified address from the stability pool.
     * @param _poolAddress The address of the pool to transfer from
     * @param _receiver The address to transfer to.
     * @param _amount The amount to be transferred.
     */
    function returnFromPool(address _poolAddress, address _receiver, uint256 _amount) external;

    /**
     * @notice Reserve balance for making payments for gas in this StableToken currency.
     * @param from The account to reserve balance from
     * @param value The amount of balance to reserve
     * @dev Note that this function is called by the protocol when paying for tx fees in this
     * currency. After the tx is executed, gas is refunded to the sender and credited to the
     * various tx fee recipients via a call to `creditGasFees`.
     */
    function debitGasFees(address from, uint256 value) external;

    /**
     * @notice Alternative function to credit balance after making payments
     * for gas in this StableToken currency.
     * @param from The account to debit balance from
     * @param feeRecipient Coinbase address
     * @param gatewayFeeRecipient Gateway address
     * @param communityFund Community fund address
     * @param refund amount to be refunded by the VM
     * @param tipTxFee Coinbase fee
     * @param baseTxFee Community fund fee
     * @param gatewayFee Gateway fee
     * @dev Note that this function is called by the protocol when paying for tx fees in this
     * currency. Before the tx is executed, gas is debited from the sender via a call to
     * `debitGasFees`.
     */
    function creditGasFees(
        address from,
        address feeRecipient,
        address gatewayFeeRecipient,
        address communityFund,
        uint256 refund,
        uint256 tipTxFee,
        uint256 gatewayFee,
        uint256 baseTxFee
    ) external;

    /**
     * @notice Credit gas fees to multiple addresses.
     * @param recipients The addresses to credit the fees to.
     * @param amounts The amounts of fees to credit to each address.
     */
    function creditGasFees(address[] calldata recipients, uint256[] calldata amounts) external;
}
