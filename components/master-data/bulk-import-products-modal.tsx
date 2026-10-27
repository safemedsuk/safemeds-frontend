'use client'

import { BulkImportModal } from '@/components/bulk-import/bulk-import-modal'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/api/master-data'
import { useTranslation } from '@/lib/i18n/use-translation'

interface Props {
  onClose: () => void
  onImported: () => void
}

const IMPORT_TYPE = 'product'

const TEMPLATE_CSV = `Brand Name,Generic Name,Category,Dosage Form,Strength,INN Name,ATC Code,Formulation,Route,Site of Manufacture,Pack Size(s)
Amoxiclav,Amoxicillin/Clavulanate,Medicinal,Tablet,500mg/125mg,Amoxicillin,J01CR02,Immediate release,Oral,Nairobi Kenya,10s blister;30s bottle
Panadol,Paracetamol,Medicinal,Tablet,500mg,Paracetamol,N02BE01,,Oral,,24s blister
`

/**
 * VigiCloud Stage 2 — bulk-importing a company's product catalog by CSV
 * or Excel, matching the user's own request ("anywhere data is
 * created... good to have bulk import through CSV files and even Excel
 * files") — the exact scenario the todo doc's own Stage 2 planning calls
 * out: *"Onboard of a new client should provide product list per
 * country."* A thin, importer-specific wrapper around the shared
 * `BulkImportModal`, same pattern as `BulkImportUsersModal`.
 */
export function BulkImportProductsModal({ onClose, onImported }: Props) {
  const { t } = useTranslation()
  return (
    <BulkImportModal
      importType={IMPORT_TYPE}
      title={t('bulkImportProducts.title')}
      description={
        <>
          {t('bulkImportProducts.descLead')} <strong>{t('bulkImportProducts.descBrandName')}</strong>,{' '}
          <strong>{t('bulkImportProducts.descGenericName')}</strong>, <strong>{t('bulkImportProducts.descCategory')}</strong>,{' '}
          <strong>{t('bulkImportProducts.descDosageForm')}</strong>, {t('common.and')}{' '}
          <strong>{t('bulkImportProducts.descStrength')}</strong> {t('bulkImportProducts.descRequiredSuffix')}{' '}
          {t('bulkImportProducts.descOptional')}
          <code className="bg-[var(--surface-raised)] px-1 rounded">;</code>
          {t('bulkImportProducts.descSemicolonSuffix')}
        </>
      }
      helpPanel={{ title: t('bulkImportProducts.helpPanelTitle'), values: Object.values(PRODUCT_CATEGORY_LABELS) }}
      templateFilename="safemeds-bulk-product-import-template.csv"
      templateCsv={TEMPLATE_CSV}
      resultLabel={(committed) =>
        t('bulkImportProducts.resultLabel', {
          count: String(committed),
          productWord: committed === 1 ? t('bulkImportProducts.productSingular') : t('bulkImportProducts.productPlural'),
        })
      }
      onClose={onClose}
      onImported={onImported}
    />
  )
}
