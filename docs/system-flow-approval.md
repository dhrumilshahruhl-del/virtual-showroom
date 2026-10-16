# System Flow Engineering Approval

All six steps and their current descriptions are preserved as implemented. **Engineer/RUHL approval is pending**; this document records claims to verify and does not change the engineering narrative.

| Step | Current user-facing wording | Equipment | Depicted airflow path | Energy-transfer statement | Assumptions / approval status |
|---|---|---|---|---|---|
| Return Air | Used indoor air is carried through ducts from the building to the rooftop AHU, bringing heating or cooling energy that can be recovered. | Extract AHUs and ducts | Indoor return/extract to rooftop AHUs | Remaining heat/coolness is available for recovery | Return/extract path and AHU involvement require engineer/RUHL confirmation. Pending. |
| Energy Recovery | The warmth or coolness is transferred to the incoming fresh air without mixing the two air streams. | AHUs and energy-recovery circuits | Separate extract and fresh-air paths | Recovery transfers thermal energy; “air streams do not mix” is asserted | Mechanism, placement, transfer, and no-mixing statement require engineer confirmation. Pending. |
| Exhaust | After its energy has been recovered, the remaining exhaust air is safely discharged outdoors. | Extract AHUs, exhaust ducts/hoods | AHU/recovery path to outdoor discharge | Residual energy has already been recovered | Exhaust-after-recovery depiction and “safely” wording require approval. Pending. |
| Fresh Outdoor Air | Fresh outdoor air enters the system to replace the used indoor air. Recovered energy helps bring it closer to the temperature needed indoors. | Intake hoods and supply AHUs | Outdoor intake toward AHUs | Recovery preconditions incoming air | Intake/AHU relationship and recovery mechanism require approval. Pending. |
| Heat Pump | When recovered energy is not enough, the heat pump provides the additional heating or cooling needed to reach the desired temperature. | Heat pump and pipe cluster | Conditioned air path/heat-pump role as depicted | Heat pump adds heating/cooling after recovery | Water-source wording, heat-pump role, and hydronic relationship require approval. Pending. |
| Supply Air | The conditioned fresh air is delivered throughout the building to maintain a comfortable indoor environment. | Supply AHUs, ducts, outlets | AHU through supply branches to building | Conditions fresh air before delivery | Supply-air path and AHU involvement require approval. Pending. |

Specifically pending human confirmation: return/extract path; AHU involvement; exhaust-after-recovery depiction; whether the streams do not mix; energy-recovery mechanism; water-source heat-pump wording; heat-pump role; hydronic relationship; and supply-air path. No code flow was changed in this pass.
