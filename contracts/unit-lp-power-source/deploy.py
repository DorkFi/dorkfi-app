"""Deploy UnitLpPowerSource (one app per UNIT Tinyman pair) on Algorand mainnet.

Signer: ALGORAND_DEPLOYER_MNEMONIC env, or .deployer.mnemonic (gitignored).
Never prints the mnemonic.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from algosdk import account, mnemonic
from algosdk.abi import Method
from algosdk.atomic_transaction_composer import (
    AccountTransactionSigner,
    AtomicTransactionComposer,
)
from algosdk.transaction import OnComplete, StateSchema, wait_for_confirmation
from algosdk.v2client.algod import AlgodClient

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
MNEMONIC_FILE = HERE / ".deployer.mnemonic"
DEPLOYED_FILE = HERE / "deployed.json"
ALGOD_URL = "https://mainnet-api.4160.nodely.dev"

PAIRS = [
    {
        "pairId": "unit-algo",
        "ntoken_app_id": 3577729953,
        "pool_address": "5T5VBTBOPW2ZRJX6QJYCBMZ24VAW7IWFGV7GHCBKFNKIN2XYHP5OLOSQJQ",
        "unit_asset_id": 3121954282,
        "validator_app_id": 1002541853,
    },
    {
        "pairId": "unit-gobtc",
        "ntoken_app_id": 3577777819,
        "pool_address": "YQJ7QB4AWGA6XDHABFI5JXSDQUMM4JVG7EG4FXT4WQXUKVA44BGSSN2BZA",
        "unit_asset_id": 3121954282,
        "validator_app_id": 1002541853,
    },
    {
        "pairId": "wad-unit",
        "ntoken_app_id": 3577783311,
        "pool_address": "77FCRUX5B4AKC3SQ4KB6SP6SIXUQFU3QYYTZSJWMOSDJO3AO4E6P4Z6EXE",
        "unit_asset_id": 3121954282,
        "validator_app_id": 1002541853,
    },
]

CREATE = Method.from_signature(
    "create(uint64,address,uint64,uint64)void"
)


def algod_client() -> AlgodClient:
    return AlgodClient("", ALGOD_URL, headers={"User-Agent": "dorkfi-unit-lp-power"})


def compile_teal(client: AlgodClient, path: Path) -> bytes:
    src = path.read_text(encoding="utf-8")
    result = client.compile(src)
    import base64

    return base64.b64decode(result["result"])


def load_or_create_deployer() -> tuple[str, str]:
    raw = os.environ.get("ALGORAND_DEPLOYER_MNEMONIC", "").strip()
    if not raw and MNEMONIC_FILE.exists():
        raw = MNEMONIC_FILE.read_text(encoding="utf-8").strip()
    if not raw:
        sk = account.generate_account()[0]
        raw = mnemonic.from_private_key(sk)
        MNEMONIC_FILE.write_text(raw + "\n", encoding="utf-8")
        try:
            os.chmod(MNEMONIC_FILE, 0o600)
        except OSError:
            pass
    sk = mnemonic.to_private_key(raw)
    addr = account.address_from_private_key(sk)
    return addr, sk


def deploy_one(
    client: AlgodClient,
    sender: str,
    sk: str,
    approval: bytes,
    clear: bytes,
    pair: dict,
) -> dict:
    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = 2000
    signer = AccountTransactionSigner(sk)
    atc = AtomicTransactionComposer()
    atc.add_method_call(
        app_id=0,
        method=CREATE,
        sender=sender,
        sp=sp,
        signer=signer,
        method_args=[
            pair["ntoken_app_id"],
            pair["pool_address"],
            pair["unit_asset_id"],
            pair["validator_app_id"],
        ],
        on_complete=OnComplete.NoOpOC,
        approval_program=approval,
        clear_program=clear,
        global_schema=StateSchema(num_uints=3, num_byte_slices=1),
        local_schema=StateSchema(num_uints=0, num_byte_slices=0),
        extra_pages=0,
        note=f"unit-lp-power {pair['pairId']}".encode(),
    )
    result = atc.execute(client, 4)
    txid = result.tx_ids[0]
    info = wait_for_confirmation(client, txid, 8)
    app_id = info["application-index"]
    return {
        "pairId": pair["pairId"],
        "appId": app_id,
        "txid": txid,
        "confirmedRound": info.get("confirmed-round"),
        "ntokenAppId": pair["ntoken_app_id"],
        "poolAddress": pair["pool_address"],
    }


def main() -> None:
    client = algod_client()
    sender, sk = load_or_create_deployer()
    info = client.account_info(sender)
    micro = int(info.get("amount", 0))
    print(f"deployer {sender}")
    print(f"balance_microalgos {micro}")
    if micro < 1_500_000:
        print("NEED_FUNDS min_microalgos 1500000 (~1.5 ALGO) to create three apps")
        print("Fund the deployer address, then re-run deploy.py")
        return

    approval = compile_teal(client, OUT / "UnitLpPowerSource.approval.teal")
    clear = compile_teal(client, OUT / "UnitLpPowerSource.clear.teal")
    deployed = []
    for pair in PAIRS:
        row = deploy_one(client, sender, sk, approval, clear, pair)
        print(json.dumps(row, indent=2))
        deployed.append(row)

    payload = {
        "network": "algorand-mainnet",
        "deployer": sender,
        "governanceAppId": 3436627998,
        "add_power_source": {
            "power_multiplier": 1,
            "power_source_supported_modes": None,
            "note": "Copy supported_modes from existing UNIT nToken source 3333783429",
        },
        "apps": deployed,
    }
    DEPLOYED_FILE.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {DEPLOYED_FILE}")


if __name__ == "__main__":
    main()
