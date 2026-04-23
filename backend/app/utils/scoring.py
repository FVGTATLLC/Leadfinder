WEIGHTS = {
    "industry_fit": 0.3,
    "size_fit": 0.2,
    "revenue_fit": 0.2,
    "city_fit": 0.15,
    "travel_intensity_fit": 0.15,
}

REVENUE_RANGE_MAP: dict[str, tuple[int, int]] = {
    "0-1M": (0, 1_000_000),
    "1M-10M": (1_000_000, 10_000_000),
    "10M-50M": (10_000_000, 50_000_000),
    "50M-100M": (50_000_000, 100_000_000),
    "100M-500M": (100_000_000, 500_000_000),
    "500M-1B": (500_000_000, 1_000_000_000),
    "1B+": (1_000_000_000, 10_000_000_000),
}


def _parse_revenue_midpoint(revenue_range: str | None) -> int | None:
    """Convert a revenue range string to a midpoint integer."""
    if not revenue_range:
        return None
    cleaned = revenue_range.strip()
    if cleaned in REVENUE_RANGE_MAP:
        low, high = REVENUE_RANGE_MAP[cleaned]
        return (low + high) // 2
    return None


def _linear_decay(value: int | float, min_val: int | float, max_val: int | float) -> float:
    """Return 1.0 if value is within [min_val, max_val], linear decay outside."""
    if min_val is None and max_val is None:
        return 1.0
    if min_val is not None and max_val is not None:
        if min_val <= value <= max_val:
            return 1.0
        range_size = max_val - min_val
        if range_size <= 0:
            range_size = 1
        if value < min_val:
            distance = min_val - value
        else:
            distance = value - max_val
        decay = max(0.0, 1.0 - (distance / range_size))
        return decay
    if min_val is not None:
        if value >= min_val:
            return 1.0
        distance = min_val - value
        decay = max(0.0, 1.0 - (distance / max(min_val, 1)))
        return decay
    # max_val is not None
    if value <= max_val:
        return 1.0
    distance = value - max_val
    decay = max(0.0, 1.0 - (distance / max(max_val, 1)))
    return decay


def _industry_fit(company_industry: str | None, icp_industries: list[str]) -> float:
    if not icp_industries:
        return 1.0
    if not company_industry:
        return 0.0
    normalized_company = company_industry.strip().lower()
    normalized_icp = [i.strip().lower() for i in icp_industries]
    if normalized_company in normalized_icp:
        return 1.0
    return 0.0


def _size_fit(
    employee_count: int | None,
    employee_min: int | None,
    employee_max: int | None,
) -> float:
    if employee_min is None and employee_max is None:
        return 1.0
    if employee_count is None:
        return 0.0
    return _linear_decay(employee_count, employee_min, employee_max)


def _revenue_fit(
    revenue_range: str | None,
    revenue_min: int | None,
    revenue_max: int | None,
) -> float:
    if revenue_min is None and revenue_max is None:
        return 1.0
    midpoint = _parse_revenue_midpoint(revenue_range)
    if midpoint is None:
        return 0.0
    return _linear_decay(midpoint, revenue_min, revenue_max)


def _city_fit(company_city: str | None, icp_cities: list[str]) -> float:
    """Match company city against target Nigerian cities."""
    if not icp_cities:
        return 1.0
    if not company_city:
        return 0.0
    normalized_company = company_city.strip().lower()
    normalized_icp = [c.strip().lower() for c in icp_cities]
    if normalized_company in normalized_icp:
        return 1.0
    return 0.0


def _travel_intensity_fit(
    company_travel: str | None,
    icp_travel_intensities: list[str],
) -> float:
    if not icp_travel_intensities:
        return 1.0
    if not company_travel:
        return 0.0
    normalized_company = company_travel.strip().lower()
    normalized_icp = [t.strip().lower() for t in icp_travel_intensities]
    if normalized_company in normalized_icp:
        return 1.0
    return 0.0


def score_company_against_icp(company_data: dict, icp_filters: dict) -> dict:
    """
    Score a company against ICP filters.

    Args:
        company_data: dict with keys like industry, employee_count, revenue_range,
                      geography, travel_intensity
        icp_filters: dict with keys like industry (list), geography (list),
                     revenue_min, revenue_max, employee_min, employee_max,
                     travel_intensity (list)

    Returns:
        dict with 'score' (0-100 float) and 'breakdown' dict of dimension scores.
    """
    industry = _industry_fit(
        company_data.get("industry"),
        icp_filters.get("industry", []),
    )
    size = _size_fit(
        company_data.get("employee_count"),
        icp_filters.get("employee_min"),
        icp_filters.get("employee_max"),
    )
    revenue = _revenue_fit(
        company_data.get("revenue_range"),
        icp_filters.get("revenue_min"),
        icp_filters.get("revenue_max"),
    )
    city = _city_fit(
        company_data.get("city"),
        icp_filters.get("city", icp_filters.get("geography", [])),
    )
    travel = _travel_intensity_fit(
        company_data.get("travel_intensity"),
        icp_filters.get("travel_intensity", []),
    )

    breakdown = {
        "industry_fit": round(industry, 4),
        "size_fit": round(size, 4),
        "revenue_fit": round(revenue, 4),
        "city_fit": round(city, 4),
        "travel_intensity_fit": round(travel, 4),
    }

    weighted_score = sum(
        breakdown[dimension] * WEIGHTS[dimension] for dimension in WEIGHTS
    )

    score = round(weighted_score * 100, 2)

    return {
        "score": score,
        "breakdown": breakdown,
    }
