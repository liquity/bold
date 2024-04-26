const fundAccounts = async (accounts, token) => {
  return Promise.all(
    accounts.map((account) => (
      token.mint(account, String(10n ** 36n))
    )),
  );
};

module.exports = { fundAccounts };
