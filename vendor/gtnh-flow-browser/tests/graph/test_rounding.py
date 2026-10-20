import math
import pytest
from src.graph._rounding import ceil_stable


@pytest.mark.parametrize('number,expected', [
    (48.00000000000001, 48),
    (math.nextafter(48.0, math.inf), 48),
    (1.0000000000000002, 1),
    (48.000001, 49),
    (48.1, 49),
    (1.6, 2),
    (0.0, 0),
    (0.000001, 1),
])
def test_ceil_ignores_only_floating_point_noise(number, expected):
    assert ceil_stable(number) == expected
