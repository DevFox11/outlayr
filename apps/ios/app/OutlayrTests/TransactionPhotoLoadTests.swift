//
//  TransactionPhotoLoadTests.swift
//  OutlayrTests
//
//  The decode half of the picker's photo load, pinned so failures surface as an
//  error state instead of silently doing nothing.
//

import Foundation
import UIKit
import Testing

@testable import Outlayr

struct TransactionPhotoLoadTests {
    private func validPNG() -> Data {
        UIGraphicsImageRenderer(size: CGSize(width: 8, height: 8)).image { ctx in
            UIColor.systemTeal.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 8, height: 8))
        }.pngData()!
    }

    private func assertFailure(
        _ result: Result<UIImage, TransactionIdentityPickerSheet.PhotoLoadError>,
        _ expected: TransactionIdentityPickerSheet.PhotoLoadError
    ) {
        guard case let .failure(error) = result else {
            Issue.record("expected .failure(\(expected)), got \(result)")
            return
        }
        #expect(error == expected)
    }

    @Test func decodeNilTransferFailsWithNoData() {
        assertFailure(TransactionIdentityPickerSheet.decode(nil), .noData)
    }

    @Test func decodeEmptyTransferFailsWithNoData() {
        assertFailure(TransactionIdentityPickerSheet.decode(Data()), .noData)
    }

    @Test func decodeGarbageBytesFailAsUndecodable() {
        assertFailure(TransactionIdentityPickerSheet.decode(Data([0x00, 0x01, 0x02, 0x03])), .undecodable)
    }

    @Test func decodeValidImageSucceeds() {
        let result = TransactionIdentityPickerSheet.decode(validPNG())
        guard case .success = result else {
            Issue.record("expected a decoded image, got \(result)")
            return
        }
    }

    @Test func errorMessagesAreUserFacing() {
        #expect(TransactionIdentityPickerSheet.PhotoLoadError.noData.message.isEmpty == false)
        #expect(TransactionIdentityPickerSheet.PhotoLoadError.undecodable.message.isEmpty == false)
    }
}
