import { describe, expect, it } from "vitest";
import { signS3 } from "@/lib/s3-sign";

describe("signS3", () => {
  // "GET Object" example from the AWS Signature Version 4 documentation for S3
  it("matches AWS's published example signature", () => {
    const headers = signS3(
      "GET",
      new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
      { Range: "bytes=0-9" },
      null,
      { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region: "us-east-1" },
      new Date("2013-05-24T00:00:00Z")
    );
    expect(headers.Authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request," +
        "SignedHeaders=host;range;x-amz-content-sha256;x-amz-date," +
        "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"
    );
    expect(headers["x-amz-date"]).toBe("20130524T000000Z");
  });
});
