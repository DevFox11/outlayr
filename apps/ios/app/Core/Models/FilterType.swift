//
//  FilterType.swift
//  Bonsai
//
//  Created by Rafael Soh on 3/6/22.
//

import Foundation

enum FilterType: String, CaseIterable {
    case all = "all entries"
    case type = "by type"
    case day = "by day"
    case week = "by week"
    case month = "by month"
    case category = "by category"
    case recurring
    case upcoming

    /// A name only renders if the bundled font carries a ligature for it.
    /// calendar-03 has none, hence -04 for the month row.
    static let iconNames: [FilterType: String] = [
        .all: "invoice-01",
        .type: "arrow-data-transfer-vertical",
        .day: "calendar-01",
        .week: "calendar-02",
        .month: "calendar-04",
        .category: "tags",
        .recurring: "repeat",
        .upcoming: "clock-01"
    ]
}
