
from flask import Flask, request, jsonify
from flask_cors import CORS

from division import signed_magnitude_division

app = Flask(__name__)
CORS(app)


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "running",
        "project": "Signed Magnitude Division Simulator"
    })


@app.route("/api/divide", methods=["POST"])
def divide():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Request body must be valid JSON."
        }), 400

    dividend = data.get("dividend")
    divisor = data.get("divisor")
    bits = data.get("bits", 4)

    for name, value in (
        ("dividend", dividend),
        ("divisor", divisor),
        ("bits", bits)
    ):
        if isinstance(value, bool) or not isinstance(value, int):
            return jsonify({
                "error": f"{name} must be an integer."
            }), 400

    try:
        result = signed_magnitude_division(
            dividend=dividend,
            divisor=divisor,
            n=bits
        )

        status_code = 422 if result.get("overflow") else 200
        return jsonify(result), status_code

    except OverflowError as error:
        return jsonify({
            "error": str(error),
            "overflow": True
        }), 422

    except ValueError as error:
        return jsonify({
            "error": str(error)
        }), 400


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
