const fundAccounts = async (accounts, token) => {
  // const areAccountsAlreadyFunded = await token
  //   .balanceOf(accounts[0])
  //   .gte(_1e36Str);
  // if (areAccountsAlreadyFunded) return;

  return Promise.all(
    accounts.map((account) => (
      token.mint(account, String(10n ** 36n))
    ))
  );
};

module.exports = { fundAccounts };
