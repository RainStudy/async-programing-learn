import java.util.Scanner;

/**
 * PACKAGE_NAME.null.java
 * kotlin-coroutine
 *
 * @author 寒雨
 * @since 2022/10/20 下午9:29
 */
public class Level3 {
    String[][] student;
    static Level3 myStudent = new Level3();

    // 只需要一个scanner
    static Scanner scanner = new Scanner(System.in);

    /**
     *
     * @param count 学生数量
     */
    public void showMenu(int count){
        System.out.println("请选择服务项目:");
        System.out.println("1.学生信息录入");
        System.out.println("2.学生信息增加");
        System.out.println("3.学生信息删除");
        System.out.println("4.学生信息修改");
        System.out.println("5.按学生信息按学号从小到大排序打印");
        // 之前你是直接就把他初始化了，那个时候m还没有被赋值，默认为0
        // 所以你实际上初始化了一个0行2列的二维数组，for循环遍历的时候就直接退出了，就什么都没有发生
        // 我这里改成了用参数传入学生数量，然后在这个方法里初始化二维数组
        student = new String[count][2];
        int n = scanner.nextInt();
        switch(n) {
            case 1: myStudent.scoreRecord();
                break;
            case 2: myStudent.scoreAdd();
                break;
            case 3: myStudent.scoreDelete();
                break;
            case 4: myStudent.scoreRevision();
                break;
            case 5: myStudent.scoreSort();
                break;
            default: System.out.println("输入无效，请重新输入");
        }
    }

    public void scoreRecord() {
        for (int i = 0; i < student.length; i++) {
            for (int j = 0; j < student[0].length; j++) {
                student[i][j] = scanner.nextLine();
            }
        }
    }

    public void scoreAdd() {
        for(int i = 0;i < student.length; i++) {
            if(student[i][0] == null && student[i][1] == null) {
                System.out.println("输入增加的学生信息:");
                for(int j = 0;j < student[0].length; j++) {
                    student[i][j] = scanner.nextLine();
                }
            }
        }
    }

    public void scoreDelete() {
        System.out.println("输入要删除的学生学号:");
        for(int i=0;i<student.length;i++) {
            if(student[i][0] != null && student[i][1] != null && student[i][0].equals(scanner.nextLine())) {
                student[i][0] = null;
                student[i][1] = null;
            }
        }
    }

    public void scoreRevision(){
        System.out.println("输入要修改信息的学生学号:");
        System.out.println("输入该学生的新学号：");
        System.out.println("输入该学生的新姓名：");
        for(int i=0; i < student.length; i++) {
            if(student[i][0] != null && student[i][1] != null && student[i][0].equals(scanner.nextLine())) {
                student[i][0] = scanner.nextLine();
                student[i][1] = scanner.nextLine();
            }
        }
    }
    public void scoreSort() {
        for (int i = 0; i < student.length - 1; i++) {
            for(int j = 0; j < student.length - 1 - i; j++) {
                if (student[j][0].compareTo(student [j + 1][0]) > 0) {
                    String tamp;
                    tamp = student[j][0];
                    student[j] = student[j+1];
                    student[j+1][0] = tamp;
                }
            }
        }
        System.out.println("将学生信息从小到大排序：");
        for (String[] strings : student) {
            for (int j = 0; j < student[0].length; j++)
                System.out.println(strings[j]);
        }
    }


    public static void main(String[] args) {
        System.out.println("输入学生人数：");
        myStudent.showMenu(scanner.nextInt());
    }
}
