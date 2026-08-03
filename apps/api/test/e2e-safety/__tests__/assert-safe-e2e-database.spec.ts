import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  assertSafeE2eDatabase,
  UnsafeE2eDatabaseError,
} from "../assert-safe-e2e-database";

describe("assertSafeE2eDatabase", () => {
  let tmpDir: string;
  let testEnvPath: string;
  let devEnvPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-safety-spec-"));
    testEnvPath = path.join(tmpDir, ".env.test");
    devEnvPath = path.join(tmpDir, ".env");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeEnvFile(filePath: string, databaseUrl: string): void {
    fs.writeFileSync(filePath, `DATABASE_URL=${databaseUrl}\n`);
  }

  const VALID_TEST_URL = "postgresql://u:p@localhost:5432/tripplanner_test";
  const VALID_DEV_URL = "postgresql://u:p@localhost:5432/tripplanner";

  it("accepts a valid, isolated test database", () => {
    writeEnvFile(testEnvPath, VALID_TEST_URL);
    writeEnvFile(devEnvPath, VALID_DEV_URL);

    const config = assertSafeE2eDatabase({
      env: { NODE_ENV: "test", DATABASE_URL: VALID_TEST_URL },
      testEnvPath,
      devEnvPath,
    });

    expect(config).toEqual({
      databaseUrl: VALID_TEST_URL,
      host: "localhost",
      port: "5432",
      databaseName: "tripplanner_test",
    });
  });

  it("rejects when NODE_ENV is not 'test'", () => {
    writeEnvFile(testEnvPath, VALID_TEST_URL);

    expect(() =>
      assertSafeE2eDatabase({
        env: { NODE_ENV: "development", DATABASE_URL: VALID_TEST_URL },
        testEnvPath,
        devEnvPath,
      }),
    ).toThrow(UnsafeE2eDatabaseError);
  });

  it("rejects when DATABASE_URL is missing", () => {
    writeEnvFile(testEnvPath, VALID_TEST_URL);

    expect(() =>
      assertSafeE2eDatabase({
        env: { NODE_ENV: "test" },
        testEnvPath,
        devEnvPath,
      }),
    ).toThrow(UnsafeE2eDatabaseError);
  });

  it("rejects an unparseable DATABASE_URL", () => {
    writeEnvFile(testEnvPath, "not-a-url");

    expect(() =>
      assertSafeE2eDatabase({
        env: { NODE_ENV: "test", DATABASE_URL: "not-a-url" },
        testEnvPath,
        devEnvPath,
      }),
    ).toThrow(UnsafeE2eDatabaseError);
  });

  it("rejects a non-postgres protocol (https:)", () => {
    const httpsUrl = "https://u:p@localhost:5432/tripplanner_test";
    writeEnvFile(testEnvPath, httpsUrl);

    expect(() =>
      assertSafeE2eDatabase({
        env: { NODE_ENV: "test", DATABASE_URL: httpsUrl },
        testEnvPath,
        devEnvPath,
      }),
    ).toThrow(UnsafeE2eDatabaseError);
  });

  it("rejects an empty database name", () => {
    const emptyNameUrl = "postgresql://u:p@localhost:5432/";
    writeEnvFile(testEnvPath, emptyNameUrl);

    expect(() =>
      assertSafeE2eDatabase({
        env: { NODE_ENV: "test", DATABASE_URL: emptyNameUrl },
        testEnvPath,
        devEnvPath,
      }),
    ).toThrow(UnsafeE2eDatabaseError);
  });

  it("rejects the development database name (no _test suffix)", () => {
    writeEnvFile(testEnvPath, VALID_DEV_URL);

    expect(() =>
      assertSafeE2eDatabase({
        env: { NODE_ENV: "test", DATABASE_URL: VALID_DEV_URL },
        testEnvPath,
        devEnvPath,
      }),
    ).toThrow(UnsafeE2eDatabaseError);
  });

  it("rejects an arbitrary database name without _test suffix", () => {
    const url = "postgresql://u:p@localhost:5432/staging_snapshot";
    writeEnvFile(testEnvPath, url);

    expect(() =>
      assertSafeE2eDatabase({
        env: { NODE_ENV: "test", DATABASE_URL: url },
        testEnvPath,
        devEnvPath,
      }),
    ).toThrow(UnsafeE2eDatabaseError);
  });

  // Note : "postgres", "template0" et "template1" ne se terminent jamais
  // par "_test" — la règle #3 (suffixe) les rejette donc systématiquement
  // avant même d'atteindre la règle #4 (bases système). La règle #4 reste
  // néanmoins conservée dans le code en défense en profondeur (cf. plan
  // E2E) ; ce test documente explicitement pourquoi elle n'est pas
  // testable comme branche isolément atteignable.
  it("rejects a reserved system database name (via the _test suffix rule)", () => {
    const url = "postgresql://u:p@localhost:5432/postgres";
    writeEnvFile(testEnvPath, url);

    expect(() =>
      assertSafeE2eDatabase({
        env: { NODE_ENV: "test", DATABASE_URL: url },
        testEnvPath,
        devEnvPath,
      }),
    ).toThrow(UnsafeE2eDatabaseError);
  });

  it("rejects a remote host even with a valid _test suffix", () => {
    const url =
      "postgresql://u:p@db.some-remote-host.example.com:5432/tripplanner_test";
    writeEnvFile(testEnvPath, url);

    expect(() =>
      assertSafeE2eDatabase({
        env: { NODE_ENV: "test", DATABASE_URL: url },
        testEnvPath,
        devEnvPath,
      }),
    ).toThrow(UnsafeE2eDatabaseError);
  });

  it("accepts [::1] as a local host", () => {
    const url = "postgresql://u:p@[::1]:5432/tripplanner_test";
    writeEnvFile(testEnvPath, url);

    const config = assertSafeE2eDatabase({
      env: { NODE_ENV: "test", DATABASE_URL: url },
      testEnvPath,
      devEnvPath,
    });

    expect(config.host).toBe("localhost");
  });

  it("accepts 127.0.0.1 as a local host", () => {
    const url = "postgresql://u:p@127.0.0.1:5432/tripplanner_test";
    writeEnvFile(testEnvPath, url);

    const config = assertSafeE2eDatabase({
      env: { NODE_ENV: "test", DATABASE_URL: url },
      testEnvPath,
      devEnvPath,
    });

    expect(config.host).toBe("localhost");
  });

  it("rejects a test database identical to the development database", () => {
    // Même hôte/port/nom que .env — après suffixage, on simule le cas où
    // .env pointe déjà (à tort) vers une base "_test".
    const sameUrl = "postgresql://u:p@localhost:5432/tripplanner_test";
    writeEnvFile(testEnvPath, sameUrl);
    writeEnvFile(devEnvPath, sameUrl);

    expect(() =>
      assertSafeE2eDatabase({
        env: { NODE_ENV: "test", DATABASE_URL: sameUrl },
        testEnvPath,
        devEnvPath,
      }),
    ).toThrow(UnsafeE2eDatabaseError);
  });

  it("fails closed when the dev DATABASE_URL exists but is unparseable", () => {
    writeEnvFile(testEnvPath, VALID_TEST_URL);
    writeEnvFile(devEnvPath, "not-a-url");

    expect(() =>
      assertSafeE2eDatabase({
        env: { NODE_ENV: "test", DATABASE_URL: VALID_TEST_URL },
        testEnvPath,
        devEnvPath,
      }),
    ).toThrow(UnsafeE2eDatabaseError);
  });

  it("rejects when .env.test does not exist at the given path", () => {
    const missingPath = path.join(tmpDir, "does-not-exist.env.test");

    expect(() =>
      assertSafeE2eDatabase({
        env: { NODE_ENV: "test", DATABASE_URL: VALID_TEST_URL },
        testEnvPath: missingPath,
        devEnvPath,
      }),
    ).toThrow(UnsafeE2eDatabaseError);
  });

  it("rejects when the active DATABASE_URL drifts from .env.test content", () => {
    writeEnvFile(testEnvPath, VALID_TEST_URL);
    const driftedUrl = "postgresql://u:p@localhost:5432/other_test";

    expect(() =>
      assertSafeE2eDatabase({
        env: { NODE_ENV: "test", DATABASE_URL: driftedUrl },
        testEnvPath,
        devEnvPath,
      }),
    ).toThrow(UnsafeE2eDatabaseError);
  });
});
