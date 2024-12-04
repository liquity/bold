rule check_builtin_assertions(method f) {
    env e;
    calldataarg arg;
    f(e, arg);
    assert true;
}