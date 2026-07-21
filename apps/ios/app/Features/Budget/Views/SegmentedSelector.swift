//
//  SegmentedSelector.swift
//  Outlayr
//
//  Created by Rafael Soh on 15/7/23.
//

import CoreData
import SwiftUI

struct SegmentedSelector<T: Hashable>: View {
    @Binding var selection: T
    let options: [(value: T, label: LocalizedStringKey)]

    @Namespace private var namespace

    var body: some View {
        HStack(spacing: 4) {
            ForEach(options.indices, id: \.self) { index in
                let option = options[index]
                let selected = option.value == selection

                Text(option.label)
                    .font(.system(.subheadline, design: .rounded).weight(.semibold))
                    .foregroundStyle(selected ? Color.PrimaryBackground : Color.PrimaryText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background {
                        if selected {
                            Capsule()
                                .fill(Color.PrimaryText)
                                .matchedGeometryEffect(id: "segmentedSelection", in: namespace)
                        }
                    }
                    .contentShape(Capsule())
                    .onTapGesture {
                        withAnimation(.snappy(duration: 0.25)) { selection = option.value }
                    }
            }
        }
        .padding(4)
        .background(Color.SecondaryBackground, in: Capsule())
    }
}
