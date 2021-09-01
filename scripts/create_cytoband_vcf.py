import csv
import slugid

with open('cytoBand.txt', newline = '') as cbs, open('cytoBand.vcf', 'w') as vcf_file:                                                                                          
    cbs_reader = csv.reader(cbs, delimiter='\t')
    i=0

    vcf_file.write('##fileformat=VCFv4.1\n')
    vcf_file.write('##fileDate=20210831\n')
    vcf_file.write('##source=create_cytoband_vcf.py\n')
    vcf_file.write('#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n')

    for cb in cbs_reader:
        chrom = cb[0]
        pos = cb[1]
        id = i #slugid.nice()
        ref = "."
        alt = "."
        qual = "."
        filter = "."
        info = "END=%s;NAME=%s;GIESTAIN=%s"%(cb[2],cb[3],cb[4])
        line = "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n"%(chrom,pos,id,ref,alt,qual,filter,info)
        vcf_file.write(line)
        i=i+1