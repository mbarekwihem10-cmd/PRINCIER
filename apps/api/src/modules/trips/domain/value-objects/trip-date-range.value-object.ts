import { InvalidTripDateRangeError } from "../invalid-trip-date-range.error";

interface TripDateRangeProps {
  readonly startDate: Date | null;
  readonly endDate: Date | null;
}

export class TripDateRange {
  private constructor(private readonly props: TripDateRangeProps) {}

  static create(startDate: Date | null, endDate: Date | null): TripDateRange {
    if (startDate && Number.isNaN(startDate.getTime())) {
      throw new InvalidTripDateRangeError("Trip start date is invalid");
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new InvalidTripDateRangeError("Trip end date is invalid");
    }
    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      throw new InvalidTripDateRangeError(
        "Trip end date must not be before its start date",
      );
    }

    return new TripDateRange({
      startDate: startDate ? new Date(startDate.getTime()) : null,
      endDate: endDate ? new Date(endDate.getTime()) : null,
    });
  }

  get startDate(): Date | null {
    return this.props.startDate
      ? new Date(this.props.startDate.getTime())
      : null;
  }

  get endDate(): Date | null {
    return this.props.endDate ? new Date(this.props.endDate.getTime()) : null;
  }
}
