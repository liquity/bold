const _1e36Str = "1000000000000000000000000000000000000";

const fundAccounts = async (accounts, token) => {
  // const areAccountsAlreadyFunded = await token
  //   .balanceOf(accounts[0])
  //   .gte(_1e36Str);
  // if (areAccountsAlreadyFunded) return;

  // console.log("Funding accounts with stETH");
  return accounts.forEach(async (account) => {
    await token.mint(account, _1e36Str);
  });
};

module.exports = { fundAccounts };
