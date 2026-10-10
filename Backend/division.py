
def signed_magnitude_division(dividend, divisor, n=4):
    """
    Restoring signed-magnitude division.

    A, Q, B: n-bit magnitude registers
    E:       1-bit carry/no-borrow indicator
    SC:      sequence counter

    The dividend magnitude is loaded into Q and A starts at zero.
    The quotient sign is dividend_sign XOR divisor_sign.
    The remainder sign follows the dividend.
    """

    if isinstance(n, bool) or not isinstance(n, int) or n < 1:
        raise ValueError("Register width must be a positive integer.")

    for name, value in (("Dividend", dividend), ("Divisor", divisor)):
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError(f"{name} must be an integer.")

    if divisor == 0:
        raise ValueError("Division by zero is not allowed.")

    mask = (1 << n) - 1

    dividend_magnitude = abs(dividend)
    divisor_magnitude = abs(divisor)

    if dividend_magnitude > mask:
        raise OverflowError(
            f"Dividend magnitude must fit in {n} bits (0 to {mask})."
        )

    if divisor_magnitude > mask:
        raise OverflowError(
            f"Divisor magnitude must fit in {n} bits (0 to {mask})."
        )

    dividend_sign = int(dividend < 0)
    divisor_sign = int(divisor < 0)
    quotient_sign = dividend_sign ^ divisor_sign

    # Registers
    A = 0
    Q = dividend_magnitude
    B = divisor_magnitude
    E = 0
    SC = n

    trace = []

    def record(operation, detail, decision="—"):
        trace.append({
            "step": len(trace) + 1,
            "operation": operation,
            "detail": detail,
            "A": A,
            "Q": Q,
            "B": B,
            "E": E,
            "SC": SC,
            "decision": decision
        })

    def subtract_from_A():
        """
        Compute A - B using n-bit arithmetic.
        E=1 means no borrow (A >= B).
        E=0 means borrow (A < B).
        """
        nonlocal A, E

        result = A + ((~B) & mask) + 1
        E = (result >> n) & 1
        A = result & mask

    def restore_A():
        """Restore A by adding B back modulo 2^n."""
        nonlocal A, E

        result = A + B
        E = (result >> n) & 1
        A = result & mask

    record(
        "Initialize",
        "Load dividend magnitude into Q, divisor magnitude into B; "
        "clear A and E; initialize SC = n.",
        "READY"
    )

    # Initial subtraction / divide-overflow check from the flowchart.
    original_A = A
    subtract_from_A()

    record(
        "Initial subtraction",
        "Compute A - B to check whether the initial partial "
        "remainder is at least the divisor.",
        f"E = {E}"
    )

    if E == 1:
        return {
            "error": "Divide overflow: initial A is greater than or equal to B.",
            "overflow": True,
            "dividend": dividend,
            "divisor": divisor,
            "register_width": n,
            "trace": trace
        }

    # Initial subtraction borrowed, so restore the original A.
    restore_A()

    record(
        "Initial restore",
        "A < B. Restore A by adding B back; continue the division.",
        "CONTINUE"
    )

    # Restoring division loop: one quotient bit per iteration.
    while SC > 0:
        # Shift the combined EAQ register left by one position.
        old_A = A
        old_Q = Q

        E = (old_A >> (n - 1)) & 1
        A = ((old_A << 1) | ((old_Q >> (n - 1)) & 1)) & mask
        Q = (old_Q << 1) & mask

        record(
            "Shift EAQ left",
            "Shift the combined E-A-Q registers left by one bit.",
            "SHIFT"
        )

        # Subtract divisor from A.
        subtract_from_A()

        record(
            "Subtract B",
            "Calculate A - B using n-bit one's complement plus one. "
            "E=1 indicates no borrow; E=0 indicates borrow.",
            f"E = {E}"
        )

        if E == 1:
            # A >= B: accept subtraction and set the new quotient bit.
            Q = Q | 1

            record(
                "Set quotient bit",
                "No borrow: keep the subtraction result and set Q0 = 1.",
                "A >= B"
            )
        else:
            # A < B: restore A and leave the quotient bit zero.
            restore_A()

            record(
                "Restore A",
                "Borrow occurred: restore A by adding B back. "
                "The new quotient bit remains 0.",
                "A < B"
            )

        SC -= 1

        record(
            "Decrement SC",
            "Decrease the sequence counter after completing this iteration.",
            f"SC = {SC}"
        )

    quotient_magnitude = Q
    remainder_magnitude = A

    quotient = -quotient_magnitude if quotient_sign else quotient_magnitude
    remainder = -remainder_magnitude if dividend_sign else remainder_magnitude

    def sign_magnitude(value):
        return f"{int(value < 0)}{format(abs(value), f'0{n}b')}"

    verification = (
        dividend == divisor * quotient + remainder
        and abs(remainder) < abs(divisor)
    )

    record(
        "Complete",
        "SC = 0. Quotient magnitude is in Q and remainder magnitude is in A.",
        "DONE"
    )

    return {
        "dividend": dividend,
        "divisor": divisor,
        "register_width": n,
        "dividend_sign": dividend_sign,
        "divisor_sign": divisor_sign,
        "quotient_sign": quotient_sign,
        "quotient": quotient,
        "remainder": remainder,
        "quotient_binary": sign_magnitude(quotient),
        "remainder_binary": sign_magnitude(remainder),
        "verification": verification,
        "overflow": False,
        "trace": trace
    }
