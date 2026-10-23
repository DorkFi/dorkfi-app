"""UNIT-in-LP converting power source for UNIT governance.

`snap_power` reads `arc200_balanceOf` on a registered app. LP nTokens are the
wrong unit (6-dec LP, not 8-dec UNIT) and the UNIT-per-LP ratio moves.

This app stores, per user, `floor(lp * unitReserve / issuedLp)` from Tinyman V2
local state + the user's nt200 LP nToken balance. Call `sync` in the same group
as `snap_power` so governance reads a UNIT-denominated amount.

Deploy one instance per UNIT pair (UNIT/ALGO, UNIT/goBTC, WAD/UNIT), then
`add_power_source(appId, 1, modes)` on governance 3436627998.
"""

from algopy import (
    Account,
    Application,
    ARC4Contract,
    BigUInt,
    BoxMap,
    OpUpFeeSource,
    Txn,
    UInt64,
    arc4,
    ensure_budget,
    op,
    subroutine,
)


class UnitLpPowerSource(ARC4Contract):
    def __init__(self) -> None:
        self.ntoken_app_id = UInt64()
        self.pool_address = Account()
        self.unit_asset_id = UInt64()
        self.validator_app_id = UInt64()
        self.balances = BoxMap(Account, UInt64, key_prefix=b"b")

    @arc4.abimethod(create="require")
    def create(
        self,
        ntoken_app_id: arc4.UInt64,
        pool_address: arc4.Address,
        unit_asset_id: arc4.UInt64,
        validator_app_id: arc4.UInt64,
    ) -> None:
        self.ntoken_app_id = ntoken_app_id.native
        self.pool_address = pool_address.native
        self.unit_asset_id = unit_asset_id.native
        self.validator_app_id = validator_app_id.native

    @arc4.abimethod
    def sync(self) -> arc4.UInt256:
        """Refresh Txn.sender's UNIT-equivalent from live pool + nToken."""
        ensure_budget(2000, OpUpFeeSource.GroupCredit)
        user = Txn.sender
        lp = self._ntoken_balance(user)
        issued, unit_reserve = self._pool_issued_and_unit_reserve()
        amount = UInt64(0)
        if lp > 0 and issued > 0 and unit_reserve > 0:
            wide = BigUInt(lp) * BigUInt(unit_reserve) // BigUInt(issued)
            amount = _biguint_to_uint64(wide)
        self.balances[user] = amount
        return arc4.UInt256(amount)

    @arc4.abimethod(readonly=True)
    def arc200_balanceOf(self, user: arc4.Address) -> arc4.UInt256:
        stored = self.balances.get(user.native, default=UInt64(0))
        return arc4.UInt256(stored)

    @subroutine
    def _ntoken_balance(self, user: Account) -> UInt64:
        bal, _txn = arc4.abi_call[arc4.UInt256](
            "arc200_balanceOf(address)uint256",
            arc4.Address(user),
            app_id=Application(self.ntoken_app_id),
        )
        return bal.as_uint64()

    @subroutine
    def _pool_issued_and_unit_reserve(self) -> tuple[UInt64, UInt64]:
        validator = Application(self.validator_app_id)
        pool = self.pool_address
        issued, issued_ok = op.AppLocal.get_ex_uint64(
            pool, validator, b"issued_pool_tokens"
        )
        a1_id, a1_ok = op.AppLocal.get_ex_uint64(pool, validator, b"asset_1_id")
        a2_id, a2_ok = op.AppLocal.get_ex_uint64(pool, validator, b"asset_2_id")
        r1, r1_ok = op.AppLocal.get_ex_uint64(pool, validator, b"asset_1_reserves")
        r2, r2_ok = op.AppLocal.get_ex_uint64(pool, validator, b"asset_2_reserves")
        if not (issued_ok and a1_ok and a2_ok and r1_ok and r2_ok):
            return UInt64(0), UInt64(0)
        unit_id = self.unit_asset_id
        if a1_id == unit_id:
            return issued, r1
        if a2_id == unit_id:
            return issued, r2
        return UInt64(0), UInt64(0)


@subroutine
def _biguint_to_uint64(value: BigUInt) -> UInt64:
    padded = op.bzero(8) + value.bytes
    return op.extract_uint64(padded, padded.length - 8)
