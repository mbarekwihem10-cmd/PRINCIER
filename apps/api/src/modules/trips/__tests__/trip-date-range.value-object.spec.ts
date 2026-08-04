import { InvalidTripDateRangeError } from "../domain/invalid-trip-date-range.error";
import { TripDateRange } from "../domain/value-objects/trip-date-range.value-object";

describe("TripDateRange", () => {
  it("creates successfully when both dates are null", () => {
    const range = TripDateRange.create(null, null);

    expect(range.startDate).toBeNull();
    expect(range.endDate).toBeNull();
  });

  it("creates successfully when only startDate is provided", () => {
    const startDate = new Date("2026-06-01T00:00:00.000Z");

    const range = TripDateRange.create(startDate, null);

    expect(range.startDate).toEqual(startDate);
    expect(range.endDate).toBeNull();
  });

  it("creates successfully when only endDate is provided", () => {
    const endDate = new Date("2026-06-10T00:00:00.000Z");

    const range = TripDateRange.create(null, endDate);

    expect(range.startDate).toBeNull();
    expect(range.endDate).toEqual(endDate);
  });

  it("creates successfully when endDate equals startDate", () => {
    const date = new Date("2026-06-01T00:00:00.000Z");

    const range = TripDateRange.create(date, date);

    expect(range.startDate).toEqual(date);
    expect(range.endDate).toEqual(date);
  });

  it("creates successfully when endDate is after startDate", () => {
    const startDate = new Date("2026-06-01T00:00:00.000Z");
    const endDate = new Date("2026-06-10T00:00:00.000Z");

    const range = TripDateRange.create(startDate, endDate);

    expect(range.startDate).toEqual(startDate);
    expect(range.endDate).toEqual(endDate);
  });

  it("throws InvalidTripDateRangeError when endDate is before startDate", () => {
    const startDate = new Date("2026-06-10T00:00:00.000Z");
    const endDate = new Date("2026-06-01T00:00:00.000Z");

    expect(() => TripDateRange.create(startDate, endDate)).toThrow(
      InvalidTripDateRangeError,
    );
  });

  it("throws InvalidTripDateRangeError when startDate is invalid", () => {
    const invalidDate = new Date("not-a-date");

    expect(() => TripDateRange.create(invalidDate, null)).toThrow(
      InvalidTripDateRangeError,
    );
  });

  it("throws InvalidTripDateRangeError when endDate is invalid", () => {
    const invalidDate = new Date("not-a-date");

    expect(() => TripDateRange.create(null, invalidDate)).toThrow(
      InvalidTripDateRangeError,
    );
  });

  it("returns a defensive copy from the startDate getter", () => {
    const startDate = new Date("2026-06-01T00:00:00.000Z");
    const range = TripDateRange.create(startDate, null);

    const firstRead = range.startDate;
    firstRead?.setFullYear(1999);

    expect(range.startDate).toEqual(new Date("2026-06-01T00:00:00.000Z"));
  });

  it("returns a defensive copy from the endDate getter", () => {
    const endDate = new Date("2026-06-10T00:00:00.000Z");
    const range = TripDateRange.create(null, endDate);

    const firstRead = range.endDate;
    firstRead?.setFullYear(1999);

    expect(range.endDate).toEqual(new Date("2026-06-10T00:00:00.000Z"));
  });

  it("does not let external mutation of constructor arguments affect internal state", () => {
    const startDate = new Date("2026-06-01T00:00:00.000Z");
    const endDate = new Date("2026-06-10T00:00:00.000Z");

    const range = TripDateRange.create(startDate, endDate);
    startDate.setFullYear(1999);
    endDate.setFullYear(1999);

    expect(range.startDate).toEqual(new Date("2026-06-01T00:00:00.000Z"));
    expect(range.endDate).toEqual(new Date("2026-06-10T00:00:00.000Z"));
  });
});
