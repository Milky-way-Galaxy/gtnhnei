"""Integer ceilings without promoting floating-point noise to a whole machine/EU."""
import math


def ceil_stable(value: float) -> int:
    number = float(value)
    nearest = round(number)
    # Solve results can be one or two ULPs above an exact integer. Genuine
    # fractional requirements still round upward; this is not display rounding.
    if abs(number - nearest) <= 4 * math.ulp(number):
        return int(nearest)
    return math.ceil(number)
