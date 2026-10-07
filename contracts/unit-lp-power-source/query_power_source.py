"""Read UNIT nToken power source params via algod simulate (no spend)."""

from algosdk.abi import Method, TupleType, UintType
from algosdk.transaction import ApplicationCallTxn, OnComplete, SignedTransaction
from algosdk.v2client.algod import AlgodClient
from algosdk.v2client.models import SimulateRequest, SimulateRequestTransactionGroup

ALGOD_URL = "https://mainnet-api.4160.nodely.dev"
GOVERNANCE = 3436627998
UNIT_NTOKEN = 3333783429
GET = Method.from_signature("get_power_source(uint64)(uint64,uint64,uint64)")
SENDER = "DORKHJKTKPZPV2ZLS45X4P6FV7VLE7QZQ7RZCN3DNRKXB56K22LX4RTXDI"


def main() -> None:
    client = AlgodClient("", ALGOD_URL, headers={"User-Agent": "dorkfi-unit-lp-power"})
    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = 2000
    txn = ApplicationCallTxn(
        sender=SENDER,
        sp=sp,
        index=GOVERNANCE,
        on_complete=OnComplete.NoOpOC,
        app_args=[GET.get_selector(), GET.args[0].type.encode(UNIT_NTOKEN)],
        foreign_apps=[3436628276, 3333688254, UNIT_NTOKEN],
    )
    stxn = SignedTransaction(txn, None)
    request = SimulateRequest(
        txn_groups=[SimulateRequestTransactionGroup(txns=[stxn])],
        allow_empty_signatures=True,
        allow_unnamed_resources=True,
        extra_opcode_budget=32000,
    )
    body = client.simulate_transactions(request)
    grp = body["txn-groups"][0]
    print("failure", grp.get("failure-message"))
    logs = grp.get("txn-results", [{}])[0].get("txn-result", {}).get("logs") or []
    print("logs", logs)
    if not logs:
        return
    import base64

    raw = base64.b64decode(logs[-1])
    decoded = TupleType([UintType(64), UintType(64), UintType(64)]).decode(raw[4:])
    print("power_source_id", decoded[0])
    print("power_multiplier", decoded[1])
    print("power_source_supported_modes", decoded[2])


if __name__ == "__main__":
    main()
