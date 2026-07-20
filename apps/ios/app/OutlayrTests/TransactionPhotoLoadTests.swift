//
//  TransactionPhotoLoadTests.swift
//  OutlayrTests
//
//  The decode half of the picker's photo load, pinned so failures surface as an
//  error state instead of silently doing nothing.
//

import UIKit
import XCTest

@testable import Outlayr

final class TransactionPhotoLoadTests: XCTestCase {
    private func validPNG() -> Data {
        UIGraphicsImageRenderer(size: CGSize(width: 8, height: 8)).image { ctx in
            UIColor.systemTeal.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 8, height: 8))
        }.pngData()!
    }

    private func assertFailure(
        _ result: Result<UIImage, TransactionIdentityPickerSheet.PhotoLoadError>,
        _ expected: TransactionIdentityPickerSheet.PhotoLoadError,
        file: StaticString = #filePath, line: UInt = #line
    ) {
        guard case let .failure(error) = result else {
            return XCTFail("expected .failure(\(expected)), got \(result)", file: file, line: line)
        }
        XCTAssertEqual(error, expected, file: file, line: line)
    }

    func testDecodeNilTransferFailsWithNoData() {
        assertFailure(TransactionIdentityPickerSheet.decode(nil), .noData)
    }

    func testDecodeEmptyTransferFailsWithNoData() {
        assertFailure(TransactionIdentityPickerSheet.decode(Data()), .noData)
    }

    func testDecodeGarbageBytesFailAsUndecodable() {
        assertFailure(TransactionIdentityPickerSheet.decode(Data([0x00, 0x01, 0x02, 0x03])), .undecodable)
    }

    func testDecodeValidImageSucceeds() throws {
        let result = TransactionIdentityPickerSheet.decode(validPNG())
        guard case .success = result else {
            return XCTFail("expected a decoded image, got \(result)")
        }
    }

    func testErrorMessagesAreUserFacing() {
        XCTAssertFalse(TransactionIdentityPickerSheet.PhotoLoadError.noData.message.isEmpty)
        XCTAssertFalse(TransactionIdentityPickerSheet.PhotoLoadError.undecodable.message.isEmpty)
    }
}
